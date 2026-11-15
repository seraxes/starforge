# product:payments

Shared Starforge commerce: cart, checkout, VAT-proof orders/invoices, offline + online gateways.

## Owns

- Cart / orders / intents / invoices / **coupons** / settings admin
- Coupons: `sf_pay_coupons` (+ redemptions). Code, amount or percent (`500` / `10%`), usage limit, optional `sourceModule`/`sourceId` scope. Applied in `startCheckout` — gateway charges the discounted total. Admin: `/admin/payments/coupons`. Not a separate promotions pack; not Events-local.
- Consumers: Events / Shop / Subscriptions / Ads — line sources + fulfillment hooks only; pass optional `couponCode` into `startCheckout`
- Premium merchants: own gateway + billing keys. Self-service `/admin/payments/merchant`. Payments admin adds a seller at `/admin/payments/merchants` and edits the same blocks. Offline methods are the fixed list (bank transfer, pay at entrance, cash). Online methods are one mosaic panel per registered adapter. Each block has an offer switch (`sf_pay_merchants.enabled_methods`). Checkout offers that method only when the switch is on, the seller is active, and the block is filled (`merchantMethodReady` from the adapter credential schema). Keys in encrypted `sf_pay_merchant_credentials` (Stripe webhook secret is kind `stripe_webhook`). Settle to their bank; flat sub unlock; no % fee for now.
- Collect stub: `sf_pay_collect_entitlements` is frozen. When `product:subscriptions` is enabled, `hasCollectCapability` uses a resolver registered by Subscriptions (`registerCollectCapabilityResolver` → `payments.collect`). When off, the stub / ACL auto-grant stays. Payments admin (`admin.payments`) may always edit merchant profiles (keys, offer switches); collect gates merchant self-service (`assertMayCollect`), not admin setup. Payments must not import Subscriptions. Do not add plan tables under `sf_pay_*`.
- ASN currency: Hero. Payments charges real money when someone buys that token. The balance, earn actions, and spend (services, subscriptions, selected events) stay out of `sf_pay_*`.

## Consumes

- Core `src/core/payments`: online gateway adapter registry (Barion / Stripe / PayPal) / manual + noop for site/dev / FiscalProvider (NAV) / BillingProvider (Billingo, Számlázz.hu). Offline methods stay a fixed list.
- Email Manager: `product:payments/*` triggers — never `getMailer()` here

## Add an online gateway

A developer ships the gateway in the build. An admin then enables the method and pastes keys (Payments settings, the merchant panel, and Environment for site keys). An admin does not add a gateway.

Offline methods (`bank_transfer`, `pay_at_entrance`, `cash`) are a fixed list, not plugins. A new online method does not get a cart, a merchant panel copy, or edits to paid / refund / expire.

1. Add `src/core/payments/<id>.ts` (server-only). Export `create<Id>PaymentsProvider(credentials?)` with the same `PaymentsProvider` methods as Barion (create, verify, refund, optional `parseWebhook`).
2. Call `registerPaymentMethodAdapter` in that file:
   - `id`, `label`, `buyerLabel`, `online: true`
   - `credentialSchema.kinds`: one `primary` row (secret, and meta `publicId` / `payeeEmail` / `apiBase` land on `GatewayCredentials`). Optional `webhookSecret` row maps to `extra.webhookSecret` (see Stripe `stripe_webhook`).
   - `credentialSchema.fields`: merchant form controls. `requiredForReady` is the offer check. `savedHint: 'panel' | 'inline'` is the masked-secret line.
   - `webhookMerchantFallback`: try merchant keys when the site env webhook verify fails.
   - `webhookGetStatusPeek`: GET on `/api/payments/<id>/webhook` peeks status and does not fulfill (Barion).
3. Import `./<id>` from `src/core/payments/register-online.ts` so boot registers it.

The same steps are on Payments → Settings, under Gateway secrets. Environment → `SF_PAYMENTS_PROVIDER` lists noop, manual, and every registered adapter, so the new id shows up there without editing the env catalog.

Site secrets stay in env. Merchant secrets stay in encrypted `sf_pay_merchant_credentials`. Checkout, refunds, expiry, and the merchant mosaic read the registry. Email stays `emitPaymentsEmail` with the same trigger keys. Do not add the gateway to `store.ts`.

## Public door

`@/modules/payments/api`

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
// A second registration on the same key appends. It does not replace the first.
// Payments writes the order status before the list runs. The first handler's
// throw still fails the request. Later listeners are logged and isolated.

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

**Sales by source** (Payments → Overview, and the same card on `/admin`) lists every installed contract module by id, plus any source module id already stored on a paid or fulfilled order. Gross, orders, and units are the last 30 days against the previous 30. Uninstalled contracts (shop, ads, until those packs are on the site) stay off the card. Shop and ads still sell through this API when they ship — they do not get their own sales screen.

## Public checkout handoff

`/[locale]/checkout/[orderId]` — consumers return this same-origin path after `startCheckout`. Gateway orders redirect to the stored provider URL; offline orders show the payment reference and instructions snapshotted on the order (`metadata.offlineInstructions`).

Online orders (registered adapter ids) in `checkout_pending` or `redirected_provider` expire at `expiresAt` (`checkoutTtlMinutes`, default 60). `expireAbandonedOnlineCheckouts` sets `expired`, sends `product:payments/expired`, and runs the consumer hook — the same path as a provider cancel. A later verified provider `succeeded` result may still revive an `expired` order via `transitionToPaid` (late webhook). Offline methods (`bank_transfer`, `pay_at_entrance`, `cash`) stay `awaiting_offline` until staff mark paid. Events calls this from its checkout-hold sweep.

## Refunds

`requestOrderRefund(orderId, { reason, requestedByUserId })` is the consumer entry (Events self-cancel with organizer `selfCancelRefund` + user confirm). Paid or fulfilled orders only.

Online methods (registered adapters) call the gateway `refund` with the stored provider ref and the order gross. Offline methods (`bank_transfer`, `pay_at_entrance`, `cash`) skip the gateway. On success the order becomes `refunded`, a `credit_note` invoice is issued (negative amounts, `creditOfInvoiceId`, fiscal outbox `submit_modifier`), Email Manager emits `product:payments/refunded`, and `runPaymentConsumerHook(..., 'refunded')` runs. A repeat call on an already refunded order re-issues the credit note if it is missing and returns ok. Do not auto-refund from consumers — organizer opt-in + buyer confirm only.
