# product:payments

Shared Starforge commerce: cart, checkout, VAT-proof orders/invoices, offline + online gateways.

## Ownership

- **This pack:** cart/orders/intents/invoices/**coupons**/settings admin + `@/modules/payments/api`
- **Coupons:** `sf_pay_coupons` (+ redemptions). Code, amount or percent (`500` / `10%`), usage limit, optional `sourceModule`/`sourceId` scope. Applied in `startCheckout` — gateway charges the discounted total. Admin: `/admin/payments/coupons`. Not a separate promotions pack; not Events-local.
- **Core `src/core/payments`:** Barion / Stripe / PayPal / manual / FiscalProvider (NAV) / BillingProvider (Billingo, Számlázz.hu)
- **Email Manager:** `product:payments/*` triggers — never `getMailer()` here
- **Consumers:** Events / Shop / Subscriptions / Ads — line sources + fulfillment hooks only; pass optional `couponCode` into `startCheckout`
- **Premium merchants:** own gateway + billing keys (`/admin/payments/merchant`); settle to their bank; flat sub unlock; no % fee for now
- **Collect stub:** `sf_pay_collect_entitlements` is frozen. `product:subscriptions` will own plans, periods, and `canCollectPayments`. Do not add plan tables under `sf_pay_*`.
- **ASN currency:** Hero. Payments charges real money when someone buys that token. The balance, earn actions, and spend (services, subscriptions, selected events) stay out of `sf_pay_*`.

See [.cursor/rules/sf-payments-module.mdc](../../../.cursor/rules/sf-payments-module.mdc), [payments-cart-plan.md](../../../docs/project-context/docs/payments-cart-plan.md), [payments-merchant-plan.md](../../../docs/project-context/docs/payments-merchant-plan.md).

Admin UI must clone Events/Layouts shell (`page-settings-panel`, `gantry-layouts-nav`) — see `sf-ui-design.mdc`.

## Consumer API

```ts
import {
  createCart,
  addCartLine,
  startCheckout,
  getOrderGrossByIds,
  registerPaymentConsumerHook,
  PAYMENT_SOURCE_TYPES,
  majorToMinor,
  formatMoneyMinor,
} from '@/modules/payments/api'

registerPaymentConsumerHook('events.confirmRegistration', async (ctx) => { /* … */ })

const cartId = await createCart({ userId })
await addCartLine(cartId, {
  ...PAYMENT_SOURCE_TYPES.eventsTicketTier,
  sourceId: tierId,
  title: 'Ticket',
  unitAmountMinor: majorToMinor(5000, 'HUF')!,
})
await startCheckout({
  cartId,
  method: 'bank_transfer',
  buyer: { email },
  idempotencyKey,
  returnUrl,
  cancelUrl,
  consumerHook: 'events.confirmRegistration',
  couponCode: 'SUMMER10', // optional — re-resolved server-side
})
```

## Coupons

| Field | Rule |
| --- | --- |
| Code | Unique, stored uppercase |
| Discount | One field: `500` = amount off; `10%` = percent off eligible gross |
| Usage limit | Integer or unlimited; counted at checkout start |
| Scope | Null/null = site-wide; `product:events` + event id = that event; same columns for shop/subscriptions later |

Consumers must not build coupon tables. Deep-link admin to `/admin/payments/coupons`.

## Source types

| sourceModule | sourceType |
| --- | --- |
| product:events | ticket_tier |
| product:shop | sku |
| product:marketplace | listing |
| product:subscriptions | plan |
| product:ads | campaign_credit |

## Public checkout handoff

`/[locale]/checkout/[orderId]` — consumers return this same-origin path after `startCheckout`. Gateway orders redirect to the stored provider URL; offline orders show the payment reference and instructions snapshotted on the order (`metadata.offlineInstructions`).

## Refunds (connector stub)

`requestOrderRefund(orderId, { reason, requestedByUserId })` is exported for consumers (e.g. Events self-cancel with organizer `selfCancelRefund` + user confirm). It validates the order is `paid`/`fulfilled`, then returns `code: 'refunds_not_implemented'`.

**Still TODO in Payments:** gateway refund, mark order `refunded`, fiscal credit note, Email Manager `product:payments/refunded`, and `runPaymentConsumerHook(..., 'refunded')` so Events cancels the seat (hook path already exists). Do not auto-refund from consumers — organizer opt-in + buyer confirm only.
