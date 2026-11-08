import type {
  CreatePaymentIntentInput,
  CreatePaymentIntentResult,
  PaymentsProvider,
  PaymentsProviderInfo,
  RefundInput,
  RefundResult,
  VerifyPaymentResult,
} from './types'

/** Dev provider — succeeds immediately without network. */
export function createNoopPaymentsProvider(): PaymentsProvider {
  return {
    async createIntent(input: CreatePaymentIntentInput): Promise<CreatePaymentIntentResult> {
      const providerRef = `noop_${input.orderId}`
      return {
        ok: true,
        provider: 'noop',
        providerRef,
        redirectUrl: input.returnUrl,
      }
    },
    async verifyIntent(providerRef: string): Promise<VerifyPaymentResult> {
      return { ok: true, status: 'succeeded', providerRef }
    },
    async refund(_input: RefundInput): Promise<RefundResult> {
      return { ok: true, refundRef: `noop_refund_${Date.now()}` }
    },
    info(): PaymentsProviderInfo {
      return {
        provider: 'noop',
        label: 'Noop (dev)',
        enabled: true,
        ready: true,
        detail: 'Immediate succeed — not for production.',
      }
    },
  }
}
