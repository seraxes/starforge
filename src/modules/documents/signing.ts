/**
 * Document signature send / webhook (decision + in-memory bag for unit tests).
 * Pack off or authz failure → door returns disabled and never writes.
 * Webhook is idempotent on provider + event id; a replay does not insert a
 * second signed Media file.
 */

import { randomUUID } from 'node:crypto'

import type { SignatureProvider } from '@/core/signatures/types'

import { runDocumentsDoor, type DocumentsDoorResult } from './door'
import type { DocumentLinkRecord, DocumentLinksBag } from './links'
import type { DocumentMediaFiles, DocumentMediaWriter } from './render'
import {
  validateApplyDocumentSignatureWebhook,
  validateSendDocumentForSignature,
  type ApplyDocumentSignatureWebhookInput,
  type SendDocumentForSignatureInput,
} from './signing-rules'

export type DocumentSignatureReceipt = {
  id: string
  providerId: string
  providerEventId: string
  envelopeId: string
  linkId: string
  status: string
  mediaId: string
  createdAt: Date
}

export type DocumentSigningBag = DocumentLinksBag & {
  receipts: Map<string, DocumentSignatureReceipt>
  media: DocumentMediaFiles
  /** envelopeId → PDF bytes available to the mock provider download path. */
  unsignedBytes: Map<string, Buffer>
}

export type SendDocumentForSignatureResult =
  | { ok: true; link: DocumentLinkRecord; envelopeId: string; providerId: string }
  | { ok: false; error: string }

export type ApplyDocumentSignatureWebhookResult =
  | {
      ok: true
      link: DocumentLinkRecord
      receipt: DocumentSignatureReceipt
      replay: boolean
    }
  | { ok: false; error: string }

export type DocumentPdfReader = {
  /** Read unsigned PDF bytes for a media id (send path). */
  read: (mediaId: string) => Promise<Buffer | null>
}

function newReceiptId(): string {
  return `dsig_${randomUUID().replace(/-/g, '')}`
}

function receiptKey(providerId: string, providerEventId: string): string {
  return `${providerId}::${providerEventId}`
}

function findLinkByTemplate(
  bag: DocumentLinksBag,
  subjectKind: string,
  subjectId: string,
  templateId: string,
): DocumentLinkRecord | null {
  let best: DocumentLinkRecord | null = null
  for (const row of bag.links.values()) {
    if (
      row.subjectKind !== subjectKind ||
      row.subjectId !== subjectId ||
      row.templateId !== templateId
    ) {
      continue
    }
    if (!best || row.generation > best.generation) best = row
  }
  return best
}

function findLinkByEnvelope(
  bag: DocumentLinksBag,
  providerId: string,
  envelopeId: string,
): DocumentLinkRecord | null {
  for (const row of bag.links.values()) {
    if (row.providerId === providerId && row.envelopeId === envelopeId) {
      return row
    }
  }
  return null
}

/**
 * Send the current generation for signature. Stores envelope id and status sent.
 */
export async function applySendDocumentForSignature(
  bag: DocumentSigningBag,
  input: SendDocumentForSignatureInput,
  deps: {
    provider: SignatureProvider
    pdfReader: DocumentPdfReader
  },
  opts?: { now?: Date },
): Promise<SendDocumentForSignatureResult> {
  const parsed = validateSendDocumentForSignature(input)
  if (!parsed.ok) return parsed

  const current = findLinkByTemplate(
    bag,
    parsed.values.subjectKind,
    parsed.values.subjectId,
    parsed.values.templateId,
  )
  if (!current) {
    return { ok: false, error: 'Document link not found for that template.' }
  }
  if (current.status === 'signed') {
    return { ok: false, error: 'Document link is already signed.' }
  }
  if (current.status === 'void') {
    return {
      ok: false,
      error: 'Document link is void; create generation + 1 first.',
    }
  }
  if (!current.mediaId) {
    return { ok: false, error: 'Document link has no media id.' }
  }

  const bytes = await deps.pdfReader.read(current.mediaId)
  if (!bytes) {
    return { ok: false, error: 'Could not read document PDF bytes.' }
  }

  const providerId =
    parsed.values.providerId || deps.provider.info().provider || 'noop'
  const created = await deps.provider.createEnvelope({
    idempotencyKey: `${current.id}:${current.generation}`,
    emailSubject:
      parsed.values.emailSubject || current.title || parsed.values.templateId,
    signerEmail: parsed.values.signerEmail,
    signerName: parsed.values.signerName || undefined,
    documentBytes: bytes,
    documentName: `${parsed.values.templateId}.pdf`,
    returnUrl: parsed.values.returnUrl || undefined,
    webhookUrl: parsed.values.webhookUrl || undefined,
    metadata: {
      linkId: current.id,
      subjectKind: current.subjectKind,
      subjectId: current.subjectId,
      templateId: current.templateId,
      generation: String(current.generation),
    },
  })
  if (!created.ok || !created.envelopeId) {
    return {
      ok: false,
      error: created.error || 'Signature provider did not return an envelope id.',
    }
  }

  const updated: DocumentLinkRecord = {
    ...current,
    status: 'sent',
    providerId,
    envelopeId: created.envelopeId,
    createdBy: parsed.values.createdBy || current.createdBy,
  }
  bag.links.set(updated.id, updated)
  bag.unsignedBytes.set(created.envelopeId, bytes)
  void opts?.now
  return {
    ok: true,
    link: updated,
    envelopeId: created.envelopeId,
    providerId,
  }
}

/**
 * Apply a signature webhook in an idempotent transaction-shaped update.
 * On signed: store the new Media id on the same link. Replay of the same
 * provider event id does not insert a second file.
 */
export async function applyDocumentSignatureWebhookInBag(
  bag: DocumentSigningBag,
  input: ApplyDocumentSignatureWebhookInput,
  deps: {
    provider: SignatureProvider
    mediaWriter: DocumentMediaWriter
  },
  opts?: { now?: Date; newReceiptId?: () => string },
): Promise<ApplyDocumentSignatureWebhookResult> {
  const parsed = validateApplyDocumentSignatureWebhook(input)
  if (!parsed.ok) return parsed

  const key = receiptKey(parsed.values.providerId, parsed.values.providerEventId)
  const existing = bag.receipts.get(key)
  if (existing) {
    const link = bag.links.get(existing.linkId)
    if (!link) {
      return { ok: false, error: 'Receipt exists but document link is missing.' }
    }
    return { ok: true, link, receipt: existing, replay: true }
  }

  const link = findLinkByEnvelope(
    bag,
    parsed.values.providerId,
    parsed.values.envelopeId,
  )
  if (!link) {
    return { ok: false, error: 'Document link not found for that envelope.' }
  }

  let mediaId = link.mediaId
  if (parsed.values.status === 'signed') {
    const downloaded = await deps.provider.downloadSignedPdf(
      parsed.values.envelopeId,
    )
    if (!downloaded.ok || !downloaded.bytes) {
      return {
        ok: false,
        error: downloaded.error || 'Could not download signed PDF.',
      }
    }
    mediaId = await deps.mediaWriter.write(downloaded.bytes, {
      title: link.title || 'Signed document',
      filename: downloaded.filename || `${parsed.values.envelopeId}-signed.pdf`,
    })
  }

  const updated: DocumentLinkRecord = {
    ...link,
    status: parsed.values.status,
    mediaId,
  }
  bag.links.set(updated.id, updated)

  const now = opts?.now ?? new Date()
  const receipt: DocumentSignatureReceipt = {
    id: (opts?.newReceiptId ?? newReceiptId)(),
    providerId: parsed.values.providerId,
    providerEventId: parsed.values.providerEventId,
    envelopeId: parsed.values.envelopeId,
    linkId: updated.id,
    status: parsed.values.status,
    mediaId,
    createdAt: now,
  }
  bag.receipts.set(key, receipt)
  return { ok: true, link: updated, receipt, replay: false }
}

export async function sendDocumentForSignatureThroughDoor(
  isEnabled: boolean | (() => boolean | Promise<boolean>),
  authorized: boolean,
  bag: DocumentSigningBag,
  input: SendDocumentForSignatureInput,
  deps: {
    provider: SignatureProvider
    pdfReader: DocumentPdfReader
  },
  opts?: { now?: Date },
): Promise<DocumentsDoorResult<SendDocumentForSignatureResult>> {
  return runDocumentsDoor(
    async () => {
      const enabled = typeof isEnabled === 'function' ? await isEnabled() : isEnabled
      return enabled && authorized
    },
    () => applySendDocumentForSignature(bag, input, deps, opts),
  )
}

export async function applyDocumentSignatureWebhookThroughDoor(
  isEnabled: boolean | (() => boolean | Promise<boolean>),
  authorized: boolean,
  bag: DocumentSigningBag,
  input: ApplyDocumentSignatureWebhookInput,
  deps: {
    provider: SignatureProvider
    mediaWriter: DocumentMediaWriter
  },
  opts?: { now?: Date; newReceiptId?: () => string },
): Promise<DocumentsDoorResult<ApplyDocumentSignatureWebhookResult>> {
  return runDocumentsDoor(
    async () => {
      const enabled = typeof isEnabled === 'function' ? await isEnabled() : isEnabled
      return enabled && authorized
    },
    () => applyDocumentSignatureWebhookInBag(bag, input, deps, opts),
  )
}

export function createDocumentSigningMemory(opts?: {
  now?: () => Date
  newId?: () => string
  newMediaId?: () => string
  newReceiptId?: () => string
  provider?: SignatureProvider
}): {
  bag: DocumentSigningBag
  mediaWriter: DocumentMediaWriter
  pdfReader: DocumentPdfReader
  provider: SignatureProvider
  seedLink: (link: DocumentLinkRecord) => void
  seedMedia: (mediaId: string, bytes?: Buffer) => void
  sendThroughDoor: (
    isEnabled: boolean,
    authorized: boolean,
    input: SendDocumentForSignatureInput,
  ) => Promise<DocumentsDoorResult<SendDocumentForSignatureResult>>
  webhookThroughDoor: (
    isEnabled: boolean,
    authorized: boolean,
    input: ApplyDocumentSignatureWebhookInput,
  ) => Promise<DocumentsDoorResult<ApplyDocumentSignatureWebhookResult>>
  linkCount: () => number
  mediaCount: () => number
  receiptCount: () => number
} {
  const bag: DocumentSigningBag = {
    links: new Map(),
    receipts: new Map(),
    media: { files: new Map() },
    unsignedBytes: new Map(),
  }
  const now = opts?.now ?? (() => new Date())
  const newMediaId =
    opts?.newMediaId ??
    (() => `media_${randomUUID().replace(/-/g, '')}`)

  const mediaWriter: DocumentMediaWriter = {
    async write(bytes, _meta) {
      const id = newMediaId()
      bag.media.files.set(id, bytes)
      return id
    },
  }

  const pdfReader: DocumentPdfReader = {
    async read(mediaId) {
      return bag.media.files.get(mediaId) ?? null
    },
  }

  const provider: SignatureProvider =
    opts?.provider ??
    ({
      async createEnvelope(input) {
        const envelopeId = `env_${input.idempotencyKey.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24)}`
        return {
          ok: true,
          provider: 'test',
          envelopeId,
          status: 'sent',
        }
      },
      async getStatus(envelopeId) {
        return {
          ok: true,
          provider: 'test',
          envelopeId,
          status: 'signed',
        }
      },
      async downloadSignedPdf(envelopeId) {
        const prior = bag.unsignedBytes.get(envelopeId)
        const bytes =
          prior ??
          Buffer.from(`%PDF-1.4 signed ${envelopeId}\n`, 'utf8')
        return {
          ok: true,
          provider: 'test',
          envelopeId,
          bytes,
          filename: `${envelopeId}-signed.pdf`,
        }
      },
      info() {
        return {
          provider: 'test',
          label: 'Test',
          enabled: true,
          ready: true,
        }
      },
    } satisfies SignatureProvider)

  return {
    bag,
    mediaWriter,
    pdfReader,
    provider,
    seedLink: (link) => {
      bag.links.set(link.id, link)
    },
    seedMedia: (mediaId, bytes) => {
      bag.media.files.set(
        mediaId,
        bytes ?? Buffer.from(`%PDF-1.4 ${mediaId}\n`, 'utf8'),
      )
    },
    sendThroughDoor: (isEnabled, authorized, input) =>
      sendDocumentForSignatureThroughDoor(
        isEnabled,
        authorized,
        bag,
        input,
        { provider, pdfReader },
        { now: now() },
      ),
    webhookThroughDoor: (isEnabled, authorized, input) =>
      applyDocumentSignatureWebhookThroughDoor(
        isEnabled,
        authorized,
        bag,
        input,
        { provider, mediaWriter },
        { now: now(), newReceiptId: opts?.newReceiptId },
      ),
    linkCount: () => bag.links.size,
    mediaCount: () => bag.media.files.size,
    receiptCount: () => bag.receipts.size,
  }
}

export type {
  ApplyDocumentSignatureWebhookInput,
  SendDocumentForSignatureInput,
} from './signing-rules'
