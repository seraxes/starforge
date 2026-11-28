/**
 * Signature infrastructure port — envelope create / status / signed PDF.
 *
 * product:documents owns the subject link, envelope id, and status.
 * This port only talks to providers; secrets stay in the env overlay.
 */

export type SignatureEnvelopeStatus =
  | 'created'
  | 'sent'
  | 'delivered'
  | 'signed'
  | 'declined'
  | 'void'
  | 'unknown'

export type CreateSignatureEnvelopeInput = {
  /** Stable idempotency / client id for the provider. */
  idempotencyKey: string
  emailSubject: string
  signerEmail: string
  signerName?: string
  /** Unsigned PDF bytes. */
  documentBytes: Buffer
  documentName: string
  returnUrl?: string
  webhookUrl?: string
  metadata?: Record<string, string>
}

export type CreateSignatureEnvelopeResult = {
  ok: boolean
  provider: string
  envelopeId?: string
  status?: SignatureEnvelopeStatus
  error?: string
}

export type SignatureStatusResult = {
  ok: boolean
  provider: string
  envelopeId: string
  status: SignatureEnvelopeStatus
  error?: string
}

export type DownloadSignedPdfResult = {
  ok: boolean
  provider: string
  envelopeId: string
  bytes?: Buffer
  filename?: string
  error?: string
}

export type SignatureProviderInfo = {
  provider: string
  label: string
  enabled: boolean
  ready: boolean
  detail?: string
}

export interface SignatureProvider {
  createEnvelope(input: CreateSignatureEnvelopeInput): Promise<CreateSignatureEnvelopeResult>
  getStatus(envelopeId: string): Promise<SignatureStatusResult>
  downloadSignedPdf(envelopeId: string): Promise<DownloadSignedPdfResult>
  info(): SignatureProviderInfo
}

export type SignatureFactoryOptions = {
  provider: string
  enabled: boolean
}
