/** What the events sweep should do with a `pending_payment` hold. */
export type AbandonedHoldAction = 'keep' | 'release'

const TERMINAL_UNPAID = new Set(['expired', 'failed', 'refunded'])
const SETTLED = new Set(['paid', 'fulfilled'])

export type AbandonedHoldInput = {
  paymentOrderId: string | null | undefined
  updatedAt: Date
  /**
   * Order row, or null when there is no id / the row is gone.
   * Pass a non-terminal status when Payments could not be read — those holds stay.
   */
  order: { status: string } | null
  ttlMinutes: number
  now: Date
}

/**
 * Release a seat only when checkout never started and the TTL has passed,
 * or when Payments already closed the order unpaid.
 * Open online checkouts, pay-at-entrance / cash / bank transfer, and paid
 * orders stay. This never promotes a hold to registered.
 */
export function abandonedHoldAction(input: AbandonedHoldInput): AbandonedHoldAction {
  const orderId = (input.paymentOrderId || '').trim()
  const ttlMs = Math.max(1, input.ttlMinutes) * 60_000
  const agedOut =
    Number.isFinite(input.updatedAt.getTime()) &&
    input.updatedAt.getTime() + ttlMs <= input.now.getTime()

  if (!orderId || !input.order) {
    return agedOut ? 'release' : 'keep'
  }

  const status = input.order.status
  if (TERMINAL_UNPAID.has(status)) return 'release'
  if (SETTLED.has(status)) return 'keep'
  return 'keep'
}
