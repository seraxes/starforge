# product:payments

Shared Starforge commerce: cart, checkout, VAT-proof orders/invoices, offline + online gateways.

## Ownership

- **This pack:** cart/orders/intents/invoices/settings admin + `@/modules/payments/api`
- **Core `src/core/payments`:** Barion / Stripe / PayPal / manual / FiscalProvider (NAV) / BillingProvider (Billingo, Számlázz.hu)
- **Email Manager:** `product:payments/*` triggers — never `getMailer()` here
- **Consumers:** Events / Shop / Subscriptions / Ads — line sources + fulfillment hooks only
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
})
```

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
