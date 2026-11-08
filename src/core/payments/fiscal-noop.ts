import type {
  FiscalInvoicePayload,
  FiscalProvider,
  FiscalProviderInfo,
  FiscalSubmitResult,
} from './types'

/** Dev fiscal adapter — accepts invoices without calling NAV. */
export function createNoopFiscalProvider(): FiscalProvider {
  return {
    async submitInvoice(payload: FiscalInvoicePayload): Promise<FiscalSubmitResult> {
      return {
        ok: true,
        skipped: true,
        fiscalRef: `noop_fiscal_${payload.invoiceId}`,
      }
    },
    async submitModifier(
      _originalInvoiceId: string,
      payload: FiscalInvoicePayload,
    ): Promise<FiscalSubmitResult> {
      return {
        ok: true,
        skipped: true,
        fiscalRef: `noop_fiscal_mod_${payload.invoiceId}`,
      }
    },
    async queryStatus(fiscalRef: string) {
      return { ok: true, status: 'skipped', error: undefined }
    },
    info(): FiscalProviderInfo {
      return {
        provider: 'noop',
        label: 'Fiscal noop (dev)',
        ready: true,
        detail: 'NAV shaped payloads accepted; no network.',
      }
    },
  }
}
