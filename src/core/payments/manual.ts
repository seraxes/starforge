import type {
  CreatePaymentIntentInput,
  CreatePaymentIntentResult,
  PaymentsProvider,
  PaymentsProviderInfo,
  VerifyPaymentResult,
} from './types'

/**
 * Offline methods (bank / entrance / cash) — no provider redirect.
 * product:payments marks paid via staff action after createIntent.
 */
export function createManualPaymentsProvider(): PaymentsProvider {
  return {
    async createIntent(input: CreatePaymentIntentInput): Promise<CreatePaymentIntentResult> {
      return {
        ok: true,
        provider: 'manual',
        providerRef: `manual_${input.orderId}`,
      }
    },
    async verifyIntent(providerRef: string): Promise<VerifyPaymentResult> {
      return {
        ok: true,
        status: 'pending',
        providerRef,
        error: 'Manual methods require staff mark-paid',
      }
    },
    info(): PaymentsProviderInfo {
      return {
        provider: 'manual',
        label: 'Manual / offline',
        enabled: true,
        ready: true,
        detail: 'Bank transfer, pay at entrance, cash.',
      }
    },
  }
}
