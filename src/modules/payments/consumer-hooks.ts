import 'server-only'

/**
 * Fulfillment hooks after paid / expired.
 * Consumers register handlers; Payments never owns Events capacity / Shop stock.
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

const hooks = new Map<string, PaymentConsumerHook>()

export function registerPaymentConsumerHook(
  key: string,
  handler: PaymentConsumerHook,
): void {
  hooks.set(key.trim(), handler)
}

export function getPaymentConsumerHook(key: string): PaymentConsumerHook | undefined {
  return hooks.get(key.trim())
}

export async function runPaymentConsumerHook(
  key: string | null | undefined,
  ctx: PaymentConsumerHookContext,
): Promise<void> {
  if (!key?.trim()) return
  const handler = hooks.get(key.trim())
  if (!handler) return
  await handler(ctx)
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
