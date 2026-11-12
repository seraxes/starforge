import { isOfflinePaymentMethod, type PaymentMethodKind } from '@/core/payments/types'

/** Gateway methods that sit in checkout until a provider webhook. */
export const ABANDONED_ONLINE_CHECKOUT_METHODS = ['barion', 'stripe', 'paypal'] as const

/** Statuses an online checkout still occupies before a webhook. */
export const ABANDONED_ONLINE_CHECKOUT_STATUSES = [
  'checkout_pending',
  'redirected_provider',
] as const

export type AbandonedOnlineCheckoutCandidate = {
  status: string
  method: string
  expiresAt: Date | null
}

/**
 * True when an online gateway checkout is past its TTL and still has no webhook.
 * Offline methods (bank transfer, pay at entrance, cash) are never expired here.
 */
export function shouldExpireAbandonedOnlineCheckout(
  order: AbandonedOnlineCheckoutCandidate,
  now: Date,
): boolean {
  if (
    !ABANDONED_ONLINE_CHECKOUT_STATUSES.includes(
      order.status as (typeof ABANDONED_ONLINE_CHECKOUT_STATUSES)[number],
    )
  ) {
    return false
  }
  if (
    !ABANDONED_ONLINE_CHECKOUT_METHODS.includes(
      order.method as (typeof ABANDONED_ONLINE_CHECKOUT_METHODS)[number],
    )
  ) {
    return false
  }
  if (isOfflinePaymentMethod(order.method as PaymentMethodKind)) return false
  if (!order.expiresAt || !Number.isFinite(order.expiresAt.getTime())) return false
  return order.expiresAt.getTime() <= now.getTime()
}
