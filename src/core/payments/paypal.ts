import 'server-only'

import type {
  CreatePaymentIntentInput,
  CreatePaymentIntentResult,
  PaymentIntentStatus,
  PaymentsProvider,
  PaymentsProviderInfo,
  RefundInput,
  RefundResult,
  VerifyPaymentResult,
} from './types'

/**
 * PayPal Orders API v2 adapter.
 * Env: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_API_BASE (optional).
 */

function apiBase(): string {
  return (
    process.env.PAYPAL_API_BASE?.trim() ||
    'https://api-m.sandbox.paypal.com'
  ).replace(/\/$/, '')
}

function clientId(): string {
  return process.env.PAYPAL_CLIENT_ID?.trim() || ''
}

function clientSecret(): string {
  return process.env.PAYPAL_CLIENT_SECRET?.trim() || ''
}

async function getAccessToken(): Promise<string | null> {
  const id = clientId()
  const secret = clientSecret()
  if (!id || !secret) return null
  const basic = Buffer.from(`${id}:${secret}`).toString('base64')
  const res = await fetch(`${apiBase()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  if (!res.ok) return null
  const data = (await res.json()) as { access_token?: string }
  return data.access_token || null
}

function mapPayPalStatus(status: string | undefined): PaymentIntentStatus {
  const s = (status || '').toUpperCase()
  if (s === 'COMPLETED' || s === 'APPROVED') return s === 'COMPLETED' ? 'succeeded' : 'requires_action'
  if (s === 'VOIDED' || s === 'CANCELLED') return 'cancelled'
  if (s === 'CREATED' || s === 'SAVED' || s === 'PAYER_ACTION_REQUIRED') return 'requires_action'
  return 'pending'
}

export function createPayPalPaymentsProvider(): PaymentsProvider {
  const ready = Boolean(clientId() && clientSecret())

  return {
    async createIntent(input: CreatePaymentIntentInput): Promise<CreatePaymentIntentResult> {
      if (!ready) {
        return { ok: false, provider: 'paypal', error: 'PayPal credentials not configured' }
      }
      const token = await getAccessToken()
      if (!token) {
        return { ok: false, provider: 'paypal', error: 'PayPal OAuth failed' }
      }
      const exp = input.currency.toUpperCase() === 'HUF' ? 0 : 2
      const value = (input.amountMinor / 10 ** exp).toFixed(exp)
      try {
        const res = await fetch(`${apiBase()}/v2/checkout/orders`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'PayPal-Request-Id': input.idempotencyKey.slice(0, 36),
          },
          body: JSON.stringify({
            intent: 'CAPTURE',
            purchase_units: [
              {
                reference_id: input.orderId.slice(0, 256),
                description: input.description.slice(0, 127),
                amount: {
                  currency_code: input.currency.toUpperCase(),
                  value,
                },
              },
            ],
            application_context: {
              return_url: input.returnUrl,
              cancel_url: input.cancelUrl,
              user_action: 'PAY_NOW',
            },
          }),
        })
        const data = (await res.json()) as {
          id?: string
          links?: Array<{ rel?: string; href?: string }>
          message?: string
        }
        const approve = data.links?.find((l) => l.rel === 'approve')?.href
        if (!res.ok || !data.id || !approve) {
          return {
            ok: false,
            provider: 'paypal',
            error: data.message || `PayPal create HTTP ${res.status}`,
          }
        }
        return {
          ok: true,
          provider: 'paypal',
          providerRef: data.id,
          redirectUrl: approve,
        }
      } catch (e) {
        return {
          ok: false,
          provider: 'paypal',
          error: e instanceof Error ? e.message : 'PayPal network error',
        }
      }
    },

    async verifyIntent(providerRef: string): Promise<VerifyPaymentResult> {
      if (!ready) {
        return {
          ok: false,
          status: 'failed',
          providerRef,
          error: 'PayPal credentials not configured',
        }
      }
      const token = await getAccessToken()
      if (!token) {
        return { ok: false, status: 'failed', providerRef, error: 'PayPal OAuth failed' }
      }
      try {
        const res = await fetch(`${apiBase()}/v2/checkout/orders/${encodeURIComponent(providerRef)}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = (await res.json()) as {
          id?: string
          status?: string
          purchase_units?: Array<{ amount?: { value?: string; currency_code?: string } }>
        }
        if (!res.ok) {
          return {
            ok: false,
            status: 'failed',
            providerRef,
            error: `PayPal order HTTP ${res.status}`,
          }
        }
        let status = mapPayPalStatus(data.status)
        // Capture if approved
        if (data.status === 'APPROVED') {
          const cap = await fetch(
            `${apiBase()}/v2/checkout/orders/${encodeURIComponent(providerRef)}/capture`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            },
          )
          const capData = (await cap.json()) as { status?: string }
          status = mapPayPalStatus(capData.status || data.status)
        }
        const amountStr = data.purchase_units?.[0]?.amount?.value
        const currency = data.purchase_units?.[0]?.amount?.currency_code
        const exp = (currency || 'USD').toUpperCase() === 'HUF' ? 0 : 2
        return {
          ok: status === 'succeeded',
          status,
          providerRef: data.id || providerRef,
          amountMinor: amountStr ? Math.round(Number(amountStr) * 10 ** exp) : undefined,
          currency: currency?.toUpperCase(),
          raw: data,
        }
      } catch (e) {
        return {
          ok: false,
          status: 'failed',
          providerRef,
          error: e instanceof Error ? e.message : 'PayPal verify error',
        }
      }
    },

    async refund(input: RefundInput): Promise<RefundResult> {
      if (!ready) return { ok: false, error: 'PayPal credentials not configured' }
      const token = await getAccessToken()
      if (!token) return { ok: false, error: 'PayPal OAuth failed' }
      // Expect capture id for refunds
      const exp = input.currency.toUpperCase() === 'HUF' ? 0 : 2
      const value = (input.amountMinor / 10 ** exp).toFixed(exp)
      try {
        const res = await fetch(
          `${apiBase()}/v2/payments/captures/${encodeURIComponent(input.providerRef)}/refund`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              amount: { value, currency_code: input.currency.toUpperCase() },
              note_to_payer: input.reason?.slice(0, 255),
            }),
          },
        )
        const data = (await res.json()) as { id?: string; message?: string }
        if (!res.ok) return { ok: false, error: data.message || `PayPal refund HTTP ${res.status}` }
        return { ok: true, refundRef: data.id }
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'PayPal refund error' }
      }
    },

    async parseWebhook(
      headers: Headers,
      rawBody: string,
    ): Promise<{ providerRef: string; status: PaymentIntentStatus } | null> {
      const webhookId = process.env.PAYPAL_WEBHOOK_ID?.trim()
      const transmissionId = headers.get('paypal-transmission-id')
      const transmissionTime = headers.get('paypal-transmission-time')
      const certUrl = headers.get('paypal-cert-url')
      const authAlgo = headers.get('paypal-auth-algo')
      const transmissionSig = headers.get('paypal-transmission-sig')

      // Fail closed without webhook id + transmission headers (required for verify-webhook-signature).
      if (!webhookId || !transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
        return null
      }

      try {
        const token = await getAccessToken()
        if (!token) return null
        const verifyRes = await fetch(`${apiBase()}/v1/notifications/verify-webhook-signature`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            auth_algo: authAlgo,
            cert_url: certUrl,
            transmission_id: transmissionId,
            transmission_sig: transmissionSig,
            transmission_time: transmissionTime,
            webhook_id: webhookId,
            webhook_event: JSON.parse(rawBody),
          }),
        })
        const verifyData = (await verifyRes.json()) as { verification_status?: string }
        if (!verifyRes.ok || verifyData.verification_status !== 'SUCCESS') {
          return null
        }

        const event = JSON.parse(rawBody) as {
          resource?: { id?: string; status?: string }
          event_type?: string
        }
        const providerRef = event.resource?.id || ''
        if (!providerRef) return null
        const verified = await this.verifyIntent(providerRef)
        return { providerRef, status: verified.status }
      } catch {
        return null
      }
    },

    info(): PaymentsProviderInfo {
      return {
        provider: 'paypal',
        label: 'PayPal',
        enabled: true,
        ready,
        detail: ready ? `API ${apiBase()}` : 'Set PAYPAL_CLIENT_ID + PAYPAL_CLIENT_SECRET',
      }
    },
  }
}
