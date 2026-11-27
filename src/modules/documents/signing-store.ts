/**
 * Document signature persistence.
 * Send stores envelope id + status sent on the current generation.
 * Webhook runs in a transaction keyed by provider event id; on signed,
 * stores the new Media id on that same link. Replay does not insert a
 * second file.
 */

import 'server-only'

import { and, eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import { getSignatureProvider } from '@/core/signatures'
import type { SignatureProvider } from '@/core/signatures/types'
import { ingestImageUpload } from '@/core/media/ingest'
import { findMediaById } from '@/core/media/resolve'
import { getMediaStorage } from '@/core/media/storage'
import { db } from '@/core/db'

import type { DocumentLinkRecord } from './links'
import { isDocumentSubjectKind } from './links-rules'
import {
  validateApplyDocumentSignatureWebhook,
  validateSendDocumentForSignature,
  type ApplyDocumentSignatureWebhookInput,
  type SendDocumentForSignatureInput,
} from './signing-rules'
import type {
  ApplyDocumentSignatureWebhookResult,
  DocumentSignatureReceipt,
  SendDocumentForSignatureResult,
} from './signing'
import {
  sfDocumentsLinks,
  sfDocumentsSignatureReceipts,
} from './schema'

function newReceiptId(): string {
  return `dsig_${randomUUID().replace(/-/g, '')}`
}

function mapLink(
  row: typeof sfDocumentsLinks.$inferSelect,
): DocumentLinkRecord | null {
  const kind = (row.subjectKind ?? '').trim()
  if (!isDocumentSubjectKind(kind)) return null
  return {
    id: row.id,
    subjectKind: kind,
    subjectId: (row.subjectId ?? '').trim(),
    templateId: (row.templateId ?? '').trim(),
    mediaId: (row.mediaId ?? '').trim(),
    title: (row.title ?? '').trim(),
    status: (row.status ?? '').trim(),
    providerId: (row.providerId ?? '').trim(),
    envelopeId: (row.envelopeId ?? '').trim(),
    generation: Number(row.generation ?? 1) || 1,
    createdAt: row.createdAt,
    createdBy: (row.createdBy ?? '').trim(),
  }
}

function mapReceipt(
  row: typeof sfDocumentsSignatureReceipts.$inferSelect,
): DocumentSignatureReceipt {
  return {
    id: row.id,
    providerId: (row.providerId ?? '').trim(),
    providerEventId: (row.providerEventId ?? '').trim(),
    envelopeId: (row.envelopeId ?? '').trim(),
    linkId: (row.linkId ?? '').trim(),
    status: (row.status ?? '').trim(),
    mediaId: (row.mediaId ?? '').trim(),
    createdAt: row.createdAt,
  }
}

async function findLinkByTemplate(input: {
  subjectKind: string
  subjectId: string
  templateId: string
}): Promise<DocumentLinkRecord | null> {
  const rows = await db
    .select()
    .from(sfDocumentsLinks)
    .where(
      and(
        eq(sfDocumentsLinks.subjectKind, input.subjectKind),
        eq(sfDocumentsLinks.subjectId, input.subjectId),
        eq(sfDocumentsLinks.templateId, input.templateId),
      ),
    )
  const mapped = rows
    .map(mapLink)
    .filter((row): row is DocumentLinkRecord => row !== null)
    .sort((a, b) => b.generation - a.generation)
  return mapped[0] ?? null
}

async function findReceipt(input: {
  providerId: string
  providerEventId: string
}): Promise<DocumentSignatureReceipt | null> {
  const rows = await db
    .select()
    .from(sfDocumentsSignatureReceipts)
    .where(
      and(
        eq(sfDocumentsSignatureReceipts.providerId, input.providerId),
        eq(sfDocumentsSignatureReceipts.providerEventId, input.providerEventId),
      ),
    )
    .limit(1)
  const row = rows[0]
  return row ? mapReceipt(row) : null
}

async function writeSignedPdfToMedia(input: {
  bytes: Buffer
  title: string
  filename: string
}): Promise<string> {
  const file = new File([new Uint8Array(input.bytes)], input.filename, {
    type: 'application/pdf',
  })
  const saved = await ingestImageUpload({
    file,
    alt: input.title,
    purpose: 'other',
    formAttachment: true,
    decodeToWebp: false,
    resize: false,
  })
  return saved.id
}

/**
 * Call the Core signature port, store envelope id, set status sent.
 */
export async function sendDocumentForSignatureInStore(
  input: SendDocumentForSignatureInput,
  providerOverride?: SignatureProvider,
): Promise<SendDocumentForSignatureResult> {
  const parsed = validateSendDocumentForSignature(input)
  if (!parsed.ok) return parsed

  const current = await findLinkByTemplate({
    subjectKind: parsed.values.subjectKind,
    subjectId: parsed.values.subjectId,
    templateId: parsed.values.templateId,
  })
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

  const doc = await findMediaById(current.mediaId)
  const key = (doc?.path || doc?.filename || '').trim()
  const stored = key ? await getMediaStorage().read(key) : null
  if (!stored?.body?.length) {
    return { ok: false, error: 'Could not read document PDF bytes.' }
  }

  const provider =
    providerOverride ??
    getSignatureProvider(parsed.values.providerId || undefined)
  const providerId = provider.info().provider

  const created = await provider.createEnvelope({
    idempotencyKey: `${current.id}:${current.generation}`,
    emailSubject:
      parsed.values.emailSubject || current.title || parsed.values.templateId,
    signerEmail: parsed.values.signerEmail,
    signerName: parsed.values.signerName || undefined,
    documentBytes: stored.body,
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

  await db
    .update(sfDocumentsLinks)
    .set({
      status: 'sent',
      providerId,
      envelopeId: created.envelopeId,
      createdBy: parsed.values.createdBy || current.createdBy,
    })
    .where(eq(sfDocumentsLinks.id, current.id))

  const refreshed = await findLinkByTemplate({
    subjectKind: parsed.values.subjectKind,
    subjectId: parsed.values.subjectId,
    templateId: parsed.values.templateId,
  })
  if (!refreshed) return { ok: false, error: 'Could not reload document link.' }
  return {
    ok: true,
    link: refreshed,
    envelopeId: created.envelopeId,
    providerId,
  }
}

/**
 * Idempotent webhook apply. Transaction keyed by provider event id.
 * On signed: download PDF through the Core port, store new mediaId on the link.
 */
export async function applyDocumentSignatureWebhookInStore(
  input: ApplyDocumentSignatureWebhookInput,
  providerOverride?: SignatureProvider,
): Promise<ApplyDocumentSignatureWebhookResult> {
  const parsed = validateApplyDocumentSignatureWebhook(input)
  if (!parsed.ok) return parsed

  const existing = await findReceipt({
    providerId: parsed.values.providerId,
    providerEventId: parsed.values.providerEventId,
  })
  if (existing) {
    const linkRows = await db
      .select()
      .from(sfDocumentsLinks)
      .where(eq(sfDocumentsLinks.id, existing.linkId))
      .limit(1)
    const link = linkRows[0] ? mapLink(linkRows[0]) : null
    if (!link) {
      return { ok: false, error: 'Receipt exists but document link is missing.' }
    }
    return { ok: true, link, receipt: existing, replay: true }
  }

  const provider =
    providerOverride ?? getSignatureProvider(parsed.values.providerId)

  return db.transaction(async (tx) => {
    const receiptRows = await tx
      .select()
      .from(sfDocumentsSignatureReceipts)
      .where(
        and(
          eq(
            sfDocumentsSignatureReceipts.providerId,
            parsed.values.providerId,
          ),
          eq(
            sfDocumentsSignatureReceipts.providerEventId,
            parsed.values.providerEventId,
          ),
        ),
      )
      .limit(1)
    if (receiptRows[0]) {
      const receipt = mapReceipt(receiptRows[0])
      const linkRows = await tx
        .select()
        .from(sfDocumentsLinks)
        .where(eq(sfDocumentsLinks.id, receipt.linkId))
        .limit(1)
      const link = linkRows[0] ? mapLink(linkRows[0]) : null
      if (!link) {
        return {
          ok: false as const,
          error: 'Receipt exists but document link is missing.',
        }
      }
      return { ok: true as const, link, receipt, replay: true }
    }

    const linkRows = await tx
      .select()
      .from(sfDocumentsLinks)
      .where(
        and(
          eq(sfDocumentsLinks.providerId, parsed.values.providerId),
          eq(sfDocumentsLinks.envelopeId, parsed.values.envelopeId),
        ),
      )
      .limit(1)
    const link = linkRows[0] ? mapLink(linkRows[0]) : null
    if (!link) {
      return {
        ok: false as const,
        error: 'Document link not found for that envelope.',
      }
    }

    let mediaId = link.mediaId
    if (parsed.values.status === 'signed') {
      const downloaded = await provider.downloadSignedPdf(
        parsed.values.envelopeId,
      )
      if (!downloaded.ok || !downloaded.bytes) {
        return {
          ok: false as const,
          error: downloaded.error || 'Could not download signed PDF.',
        }
      }
      mediaId = await writeSignedPdfToMedia({
        bytes: downloaded.bytes,
        title: link.title || 'Signed document',
        filename: downloaded.filename || `${parsed.values.envelopeId}-signed.pdf`,
      })
    }

    await tx
      .update(sfDocumentsLinks)
      .set({
        status: parsed.values.status,
        mediaId,
      })
      .where(eq(sfDocumentsLinks.id, link.id))

    const receiptId = newReceiptId()
    await tx.insert(sfDocumentsSignatureReceipts).values({
      id: receiptId,
      providerId: parsed.values.providerId,
      providerEventId: parsed.values.providerEventId,
      envelopeId: parsed.values.envelopeId,
      linkId: link.id,
      status: parsed.values.status,
      mediaId,
    })

    const refreshedRows = await tx
      .select()
      .from(sfDocumentsLinks)
      .where(eq(sfDocumentsLinks.id, link.id))
      .limit(1)
    const refreshed = refreshedRows[0] ? mapLink(refreshedRows[0]) : null
    if (!refreshed) {
      return { ok: false as const, error: 'Could not reload document link.' }
    }

    const receiptRowsAfter = await tx
      .select()
      .from(sfDocumentsSignatureReceipts)
      .where(eq(sfDocumentsSignatureReceipts.id, receiptId))
      .limit(1)
    const receipt = receiptRowsAfter[0]
      ? mapReceipt(receiptRowsAfter[0])
      : null
    if (!receipt) {
      return { ok: false as const, error: 'Could not reload signature receipt.' }
    }

    return { ok: true as const, link: refreshed, receipt, replay: false }
  })
}
