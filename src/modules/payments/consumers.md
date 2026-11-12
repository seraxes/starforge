# Payments consumer hooks (Shop / Subscriptions / Ads)

Events is wired today via `events.confirmRegistration`. Other packs use the same API when they ship.

## Register a hook

```ts
import { registerPaymentConsumerHook, PAYMENT_SOURCE_TYPES } from '@/modules/payments/api'

registerPaymentConsumerHook('shop.fulfillOrder', async (ctx) => {
  if (ctx.status !== 'paid') return
  for (const line of ctx.lines) {
    if (line.sourceModule !== PAYMENT_SOURCE_TYPES.shopSku.sourceModule) continue
    // decrement stock / mark fulfilled — Shop owns catalog
  }
})
```

## Line sources

| Pack | sourceModule | sourceType | Hook example |
| --- | --- | --- | --- |
| Events | `product:events` | `ticket_tier` | `events.confirmRegistration` |
| Shop | `product:shop` | `sku` | `shop.fulfillOrder` |
| Marketplace | `product:marketplace` | `listing` | `marketplace.listingFeePaid` |
| Subscriptions | `product:subscriptions` | `plan` | `subscriptions.activate` (set `billingPeriod` on line) |
| Ads | `product:ads` | `campaign_credit` | `ads.activateCampaign` |

Do **not** build cart/checkout/gateway UI inside those packs — call `createCart` / `addCartLine` / `startCheckout` only.

## Coupons

Pass optional `couponCode` on `startCheckout`. Payments owns codes, usage limits, and discount math. Domain packs only collect/forward the code (Events does this on registration / quick-register). Do not create per-module coupon tables.
