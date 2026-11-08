import type {
  BillingProvider,
  BillingProviderInfo,
  BillingSubmitResult,
  FiscalInvoicePayload,
} from './types'

export function createNoopBillingProvider(): BillingProvider {
  return {
    async submitInvoice(payload: FiscalInvoicePayload): Promise<BillingSubmitResult> {
      return {
        ok: true,
        skipped: true,
        externalId: `noop_bill_${payload.invoiceId}`,
      }
    },
    info(): BillingProviderInfo {
      return {
        provider: 'noop',
        label: 'Billing noop',
        ready: true,
        detail: 'No external e-invoice API',
      }
    },
  }
}
