import 'server-only'

import { createSign, createPrivateKey } from 'node:crypto'

import { registerSignatureAdapter } from './adapter'
import type {
  CreateSignatureEnvelopeInput,
  CreateSignatureEnvelopeResult,
  DownloadSignedPdfResult,
  SignatureEnvelopeStatus,
  SignatureProvider,
  SignatureProviderInfo,
  SignatureStatusResult,
} from './types'

/**
 * DocuSign eSign adapter — create envelope, read status, download signed PDF.
 *
 * Env (one site): DOCUSIGN_INTEGRATION_KEY, DOCUSIGN_USER_ID, DOCUSIGN_ACCOUNT_ID,
 * DOCUSIGN_RSA_PRIVATE_KEY (PEM), DOCUSIGN_AUTH_BASE (default account-d.docusign.com),
 * DOCUSIGN_BASE_PATH (default https://demo.docusign.net/restapi).
 *
 * An admin does not upload a provider. Secrets stay in the env overlay.
 */

function authBase(): string {
  return (
    process.env.DOCUSIGN_AUTH_BASE?.trim() || 'https://account-d.docusign.com'
  ).replace(/\/$/, '')
}

function apiBase(): string {
  return (
    process.env.DOCUSIGN_BASE_PATH?.trim() || 'https://demo.docusign.net/restapi'
  ).replace(/\/$/, '')
}

function integrationKey(): string {
  return (process.env.DOCUSIGN_INTEGRATION_KEY || '').trim()
}

function userId(): string {
  return (process.env.DOCUSIGN_USER_ID || '').trim()
}

function accountId(): string {
  return (process.env.DOCUSIGN_ACCOUNT_ID || '').trim()
}

function privateKeyPem(): string {
  return (process.env.DOCUSIGN_RSA_PRIVATE_KEY || '').trim().replace(/\\n/g, '\n')
}

function mapStatus(raw: string | undefined): SignatureEnvelopeStatus {
  const s = (raw || '').toLowerCase()
  if (s === 'completed' || s === 'signed') return 'signed'
  if (s === 'declined') return 'declined'
  if (s === 'voided' || s === 'void') return 'void'
  if (s === 'sent') return 'sent'
  if (s === 'delivered') return 'delivered'
  if (s === 'created' || s === 'draft') return 'created'
  return 'unknown'
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

async function fetchAccessToken(): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const iss = integrationKey()
  const sub = userId()
  const keyPem = privateKeyPem()
  if (!iss || !sub || !keyPem) {
    return {
      ok: false,
      error:
        'DOCUSIGN_INTEGRATION_KEY, DOCUSIGN_USER_ID, and DOCUSIGN_RSA_PRIVATE_KEY are required',
    }
  }

  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = base64url(
    JSON.stringify({
      iss,
      sub,
      aud: authBase().replace(/^https?:\/\//, ''),
      iat: now,
      exp: now + 3600,
      scope: 'signature impersonation',
    }),
  )
  const signingInput = `${header}.${payload}`
  let signature: Buffer
  try {
    const key = createPrivateKey(keyPem)
    const signer = createSign('RSA-SHA256')
    signer.update(signingInput)
    signer.end()
    signature = signer.sign(key)
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Invalid DOCUSIGN_RSA_PRIVATE_KEY',
    }
  }
  const assertion = `${signingInput}.${base64url(signature)}`

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  })
  const res = await fetch(`${authBase()}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string
    error?: string
    error_description?: string
  }
  if (!res.ok || !json.access_token) {
    return {
      ok: false,
      error: json.error_description || json.error || `DocuSign auth HTTP ${res.status}`,
    }
  }
  return { ok: true, token: json.access_token }
}

export function createDocusignSignatureProvider(): SignatureProvider {
  const acct = accountId()
  const ready = Boolean(
    integrationKey() && userId() && acct && privateKeyPem(),
  )

  return {
    async createEnvelope(
      input: CreateSignatureEnvelopeInput,
    ): Promise<CreateSignatureEnvelopeResult> {
      if (!ready) {
        return {
          ok: false,
          provider: 'docusign',
          error: 'DocuSign env keys are not configured',
        }
      }
      const auth = await fetchAccessToken()
      if (!auth.ok) return { ok: false, provider: 'docusign', error: auth.error }

      const documentBase64 = input.documentBytes.toString('base64')
      const signerName = (input.signerName || input.signerEmail).trim() || input.signerEmail
      const body: Record<string, unknown> = {
        emailSubject: input.emailSubject.slice(0, 100),
        status: 'sent',
        documents: [
          {
            documentBase64,
            name: input.documentName.slice(0, 100) || 'document.pdf',
            fileExtension: 'pdf',
            documentId: '1',
          },
        ],
        recipients: {
          signers: [
            {
              email: input.signerEmail,
              name: signerName,
              recipientId: '1',
              tabs: {
                signHereTabs: [
                  {
                    documentId: '1',
                    pageNumber: '1',
                    xPosition: '100',
                    yPosition: '100',
                  },
                ],
              },
            },
          ],
        },
      }
      if (input.webhookUrl?.trim()) {
        body.eventNotification = {
          url: input.webhookUrl.trim(),
          loggingEnabled: 'true',
          requireAcknowledgment: 'true',
          deliveryMode: 'SIM',
          events: ['envelope-completed', 'envelope-declined', 'envelope-voided'],
          eventData: { version: 'restv2.1', format: 'json', includeData: ['envelopeSummary'] },
        }
      }

      const res = await fetch(`${apiBase()}/v2.1/accounts/${acct}/envelopes`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auth.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })
      const json = (await res.json().catch(() => ({}))) as {
        envelopeId?: string
        status?: string
        message?: string
        errorCode?: string
      }
      if (!res.ok || !json.envelopeId) {
        return {
          ok: false,
          provider: 'docusign',
          error: json.message || json.errorCode || `DocuSign create HTTP ${res.status}`,
        }
      }
      return {
        ok: true,
        provider: 'docusign',
        envelopeId: json.envelopeId,
        status: mapStatus(json.status) === 'unknown' ? 'sent' : mapStatus(json.status),
      }
    },

    async getStatus(envelopeId: string): Promise<SignatureStatusResult> {
      const id = envelopeId.trim()
      if (!id) {
        return {
          ok: false,
          provider: 'docusign',
          envelopeId: '',
          status: 'unknown',
          error: 'Envelope id is required',
        }
      }
      if (!ready) {
        return {
          ok: false,
          provider: 'docusign',
          envelopeId: id,
          status: 'unknown',
          error: 'DocuSign env keys are not configured',
        }
      }
      const auth = await fetchAccessToken()
      if (!auth.ok) {
        return {
          ok: false,
          provider: 'docusign',
          envelopeId: id,
          status: 'unknown',
          error: auth.error,
        }
      }
      const res = await fetch(`${apiBase()}/v2.1/accounts/${acct}/envelopes/${id}`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      })
      const json = (await res.json().catch(() => ({}))) as {
        status?: string
        message?: string
      }
      if (!res.ok) {
        return {
          ok: false,
          provider: 'docusign',
          envelopeId: id,
          status: 'unknown',
          error: json.message || `DocuSign status HTTP ${res.status}`,
        }
      }
      return {
        ok: true,
        provider: 'docusign',
        envelopeId: id,
        status: mapStatus(json.status),
      }
    },

    async downloadSignedPdf(envelopeId: string): Promise<DownloadSignedPdfResult> {
      const id = envelopeId.trim()
      if (!id) {
        return {
          ok: false,
          provider: 'docusign',
          envelopeId: '',
          error: 'Envelope id is required',
        }
      }
      if (!ready) {
        return {
          ok: false,
          provider: 'docusign',
          envelopeId: id,
          error: 'DocuSign env keys are not configured',
        }
      }
      const auth = await fetchAccessToken()
      if (!auth.ok) {
        return { ok: false, provider: 'docusign', envelopeId: id, error: auth.error }
      }
      const res = await fetch(
        `${apiBase()}/v2.1/accounts/${acct}/envelopes/${id}/documents/combined`,
        { headers: { Authorization: `Bearer ${auth.token}` } },
      )
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        return {
          ok: false,
          provider: 'docusign',
          envelopeId: id,
          error: text.slice(0, 200) || `DocuSign download HTTP ${res.status}`,
        }
      }
      const ab = await res.arrayBuffer()
      return {
        ok: true,
        provider: 'docusign',
        envelopeId: id,
        bytes: Buffer.from(ab),
        filename: `${id}-signed.pdf`,
      }
    },

    info(): SignatureProviderInfo {
      return {
        provider: 'docusign',
        label: 'DocuSign',
        enabled: true,
        ready,
        detail: ready ? undefined : 'Set DocuSign env keys in the overlay.',
      }
    },
  }
}

registerSignatureAdapter({
  id: 'docusign',
  label: 'DocuSign',
  createProvider: () => createDocusignSignatureProvider(),
})
