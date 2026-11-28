import type {
  CreateSignatureEnvelopeInput,
  CreateSignatureEnvelopeResult,
  DownloadSignedPdfResult,
  SignatureProvider,
  SignatureProviderInfo,
  SignatureStatusResult,
} from './types'

/** Dev provider — invents an envelope id without network. */
export function createNoopSignatureProvider(): SignatureProvider {
  return {
    async createEnvelope(
      input: CreateSignatureEnvelopeInput,
    ): Promise<CreateSignatureEnvelopeResult> {
      const envelopeId = `noop_env_${input.idempotencyKey.slice(0, 48)}`
      return {
        ok: true,
        provider: 'noop',
        envelopeId,
        status: 'sent',
      }
    },
    async getStatus(envelopeId: string): Promise<SignatureStatusResult> {
      return {
        ok: true,
        provider: 'noop',
        envelopeId,
        status: 'signed',
      }
    },
    async downloadSignedPdf(envelopeId: string): Promise<DownloadSignedPdfResult> {
      const bytes = Buffer.from(`%PDF-1.4 noop signed ${envelopeId}\n`, 'utf8')
      return {
        ok: true,
        provider: 'noop',
        envelopeId,
        bytes,
        filename: `${envelopeId}.pdf`,
      }
    },
    info(): SignatureProviderInfo {
      return {
        provider: 'noop',
        label: 'Noop (dev)',
        enabled: true,
        ready: true,
        detail: 'Immediate envelope — not for production.',
      }
    },
  }
}
