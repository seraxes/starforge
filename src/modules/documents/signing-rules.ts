/**
 * Document signature status + send / webhook field validation (pure).
 */

import { isDocumentSubjectKind, type DocumentSubjectKind } from './links-rules'

export const DOCUMENT_SIGNATURE_STATUSES = [
  'draft',
  'sent',
  'signed',
  'declined',
  'void',
] as const

export type DocumentSignatureStatus = (typeof DOCUMENT_SIGNATURE_STATUSES)[number]

export type SendDocumentForSignatureInput = {
  subjectKind: string
  subjectId: string
  templateId: string
  signerEmail: string
  signerName?: string
  createdBy: string
  providerId?: string
  emailSubject?: string
  returnUrl?: string
  webhookUrl?: string
}

export type ParsedSendDocumentForSignature = {
  subjectKind: DocumentSubjectKind
  subjectId: string
  templateId: string
  signerEmail: string
  signerName: string
  createdBy: string
  providerId: string
  emailSubject: string
  returnUrl: string
  webhookUrl: string
}

export type ApplyDocumentSignatureWebhookInput = {
  providerId: string
  providerEventId: string
  envelopeId: string
  status: string
}

export type ParsedApplyDocumentSignatureWebhook = {
  providerId: string
  providerEventId: string
  envelopeId: string
  status: DocumentSignatureStatus
}

export function isDocumentSignatureStatus(
  value: string,
): value is DocumentSignatureStatus {
  return (DOCUMENT_SIGNATURE_STATUSES as readonly string[]).includes(value)
}

/** Statuses where render may still update the current generation. */
export function documentLinkAllowsRender(status: string): boolean {
  const s = (status ?? '').trim()
  return s === '' || s === 'draft' || s === 'sent'
}

export function validateSendDocumentForSignature(
  input: SendDocumentForSignatureInput,
):
  | { ok: true; values: ParsedSendDocumentForSignature }
  | { ok: false; error: string } {
  const subjectKind = (input.subjectKind ?? '').trim()
  if (!isDocumentSubjectKind(subjectKind)) {
    return { ok: false, error: 'Unknown document subject kind.' }
  }

  const subjectId = (input.subjectId ?? '').trim()
  if (!subjectId) return { ok: false, error: 'Subject id is required.' }

  const templateId = (input.templateId ?? '').trim()
  if (!templateId) return { ok: false, error: 'Template id is required.' }

  const signerEmail = (input.signerEmail ?? '').trim()
  if (!signerEmail || !signerEmail.includes('@')) {
    return { ok: false, error: 'Signer email is required.' }
  }

  return {
    ok: true,
    values: {
      subjectKind,
      subjectId,
      templateId,
      signerEmail,
      signerName: (input.signerName ?? '').trim(),
      createdBy: (input.createdBy ?? '').trim(),
      providerId: (input.providerId ?? '').trim(),
      emailSubject: (input.emailSubject ?? '').trim(),
      returnUrl: (input.returnUrl ?? '').trim(),
      webhookUrl: (input.webhookUrl ?? '').trim(),
    },
  }
}

export function validateApplyDocumentSignatureWebhook(
  input: ApplyDocumentSignatureWebhookInput,
):
  | { ok: true; values: ParsedApplyDocumentSignatureWebhook }
  | { ok: false; error: string } {
  const providerId = (input.providerId ?? '').trim()
  if (!providerId) return { ok: false, error: 'Provider id is required.' }

  const providerEventId = (input.providerEventId ?? '').trim()
  if (!providerEventId) return { ok: false, error: 'Provider event id is required.' }

  const envelopeId = (input.envelopeId ?? '').trim()
  if (!envelopeId) return { ok: false, error: 'Envelope id is required.' }

  const statusRaw = (input.status ?? '').trim().toLowerCase()
  if (!isDocumentSignatureStatus(statusRaw)) {
    return { ok: false, error: 'Unknown signature status.' }
  }

  return {
    ok: true,
    values: {
      providerId,
      providerEventId,
      envelopeId,
      status: statusRaw,
    },
  }
}
