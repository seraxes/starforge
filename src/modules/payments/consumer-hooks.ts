/**
 * Fulfillment hooks after paid / expired / failed / refunded.
 * Consumers register handlers; Payments never owns Events capacity / Shop stock.
 *
 * The public door is `@/modules/payments/api` (`import 'server-only'`).
 * This file stays free of that marker so the runner can be unit-tested.
 * `store.ts` calls `runPaymentConsumerHook` only after the order row is updated.
 */

export type PaymentConsumerHookContext = {
  orderId: string
  status: 'paid' | 'expired' | 'failed' | 'refunded'
  lines: Array<{
    sourceModule: string
    sourceType: string
    sourceId: string
    qty: number
    billingPeriod?: string | null
    metadata: Record<string, unknown>
  }>
  metadata: Record<string, unknown>
}

export type PaymentConsumerHook = (
  ctx: PaymentConsumerHookContext,
) => Promise<void> | void

const hooks = new Map<string, PaymentConsumerHook[]>()

/**
 * Append a handler. A second registration on the same key runs after the first.
 * It does not replace it. Events and Subscriptions use different keys and
 * register once, so production still runs one handler per key.
 */
export function registerPaymentConsumerHook(
  key: string,
  handler: PaymentConsumerHook,
): void {
  const id = key.trim()
  if (!id) return
  const list = hooks.get(id) ?? []
  list.push(handler)
  hooks.set(id, list)
}

/** First handler for this key, if any. The runner uses the full list. */
export function getPaymentConsumerHook(key: string): PaymentConsumerHook | undefined {
  return hooks.get(key.trim())?.[0]
}

/** Test helper. */
export function clearPaymentConsumerHooks(): void {
  hooks.clear()
}

/**
 * Run every handler for `key`, in registration order.
 *
 * The order status is already written by Payments (`store.ts`) before this
 * call. This function does not mark an order paid, expired, failed, or refunded.
 *
 * The first handler's throw rejects, matching the single-handler `await` that
 * used to live here, and later handlers do not run.
 * A later handler's throw is logged and swallowed so the remaining handlers
 * still run and the request does not fail.
 */
export async function runPaymentConsumerHook(
  key: string | null | undefined,
  ctx: PaymentConsumerHookContext,
): Promise<void> {
  if (!key?.trim()) return
  const list = hooks.get(key.trim())
  if (!list?.length) return
  await list[0]!(ctx)
  for (const handler of list.slice(1)) {
    try {
      await handler(ctx)
    } catch (error) {
      console.error('[payments] consumer hook listener failed', error)
    }
  }
}

/** Documented source modules for Shop / Subscriptions / Ads (wire when packs ship). */
export const CONSUMER_SOURCE_DOCS = `
## Consumer line sources

| sourceModule | sourceType | Fulfillment |
| --- | --- | --- |
| product:events | ticket_tier | Register seat / confirm registration on paid |
| product:shop | sku | Fulfill / decrement stock on paid |
| product:marketplace | listing | Mark listing fee paid |
| product:subscriptions | plan | Activate subscription period |
| product:ads | campaign_credit | Activate campaign / credit balance |

Register with \`registerPaymentConsumerHook('events.confirmRegistration', …)\`.
` as const
