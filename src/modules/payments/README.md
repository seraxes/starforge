# product:payments

Layer: base (manifest boot tag — not retagged)

Class: advanced — `requires` Email Manager ([2026-11-26-base-vs-advanced](../../../docs/project-context/docs/decisions/2026-11-26-base-vs-advanced.md))

Status: shipped

Shared Starforge commerce: cart, checkout, VAT-proof orders/invoices, offline + online gateways. See [.cursor/rules/sf-payments-module.mdc](../../../.cursor/rules/sf-payments-module.mdc), [payments-cart-plan.md](../../../docs/project-context/docs/payments-cart-plan.md), [payments-merchant-plan.md](../../../docs/project-context/docs/payments-merchant-plan.md). Admin UI must clone Events/Layouts shell (`page-settings-panel`, `gantry-layouts-nav`) — see `sf-ui-design.mdc`.

## Owns

Cart / orders / intents / invoices / **coupons** / settings admin. Tables include `sf_pay_settings`, `sf_pay_carts`, `sf_pay_cart_lines`, `sf_pay_merchants`, `sf_pay_merchant_credentials`, `sf_pay_collect_entitlements`, `sf_pay_orders`, `sf_pay_order_lines`, `sf_pay_intents`, `sf_pay_invoices`, `sf_pay_invoice_lines`, `sf_pay_fiscal_outbox`, `sf_pay_invoice_sequences`, `sf_pay_coupons`, `sf_pay_coupon_redemptions`, `sf_pay_recurring`.

**Coupons:** `sf_pay_coupons` (+ redemptions). Code, amount or percent (`500` / `10%`), usage limit, optional `sourceModule`/`sourceId` scope. Applied in `startCheckout` — gateway charges the discounted total. Admin: `/admin/payments/coupons`. Not a separate promotions pack; not Events-local. Code unique, stored uppercase. Null/null scope = site-wide.

**Consumers:** Events / Shop / Subscriptions / Ads — line sources + fulfillment hooks only; pass optional `couponCode` into `startCheckout`.

**Premium merchants:** Own gateway + billing keys. Self-service `/admin/payments/merchant`. Payments admin adds a seller at `/admin/payments/merchants` and edits the same blocks. Offline methods are the fixed list (bank transfer, pay at entrance, cash). Online methods are one mosaic panel per registered adapter. Each block has an offer switch (`sf_pay_merchants.enabled_methods`). Checkout offers that method only when the switch is on, the seller is active, and the block is filled (`merchantMethodReady` from the adapter credential schema). Keys in encrypted `sf_pay_merchant_credentials` (Stripe webhook secret is kind `stripe_webhook`). Settle to their bank; flat sub unlock; no % fee for now.

**Collect stub:** `sf_pay_collect_entitlements` is frozen. When `product:subscriptions` is enabled, `hasCollectCapability` uses a resolver registered by Subscriptions (`registerCollectCapabilityResolver` → `payments.collect`). When off, the stub / ACL auto-grant stays. Payments admin (`admin.payments`) may always edit merchant profiles; collect gates merchant self-service (`assertMayCollect`), not admin setup. Payments must not import Subscriptions. Do not add plan tables under `sf_pay_*`.

**ASN currency:** Hero. Payments charges real money when someone buys that token. The balance, earn actions, and spend stay out of `sf_pay_*`.

**Source types:** events `ticket_tier`, shop `sku`, marketplace `listing`, subscriptions `plan`, ads `campaign_credit`.

**Sales by source** (Payments → Overview, and the same card on `/admin`) lists every installed contract module by id, plus any source module id already stored on a paid or fulfilled order. Gross, orders, and units are the last 30 days against the previous 30. Uninstalled contracts stay off the card.

**Public checkout:** `/[locale]/checkout/[orderId]` — consumers return this same-origin path after `startCheckout`. Gateway orders redirect to the stored provider URL; offline orders show payment reference and instructions. Online orders in `checkout_pending` or `redirected_provider` expire at `expiresAt` (`checkoutTtlMinutes`, default 60). `expireAbandonedOnlineCheckouts` sets `expired`, sends `product:payments/expired`, and runs the consumer hook. Late verified provider `succeeded` may revive an `expired` order. Offline methods stay `awaiting_offline` until staff mark paid.

**Refunds:** `requestOrderRefund(orderId, { reason, requestedByUserId })`. Paid or fulfilled only. Online adapters call gateway `refund`; offline skip gateway. On success: order `refunded`, `credit_note` invoice, Email Manager `product:payments/refunded`, consumer hook `refunded`. Do not auto-refund from consumers — organizer opt-in + buyer confirm only.

**Add an online gateway:** A developer ships the gateway in the build. An admin then enables the method and pastes keys. Offline methods are not plugins. Steps: add `src/core/payments/<id>.ts` with `create<Id>PaymentsProvider`, call `registerPaymentMethodAdapter` (credential schema, webhook helpers), import from `src/core/payments/register-online.ts`. Same steps are on Payments → Settings under Gateway secrets. Do not edit `store.ts` paid / refund / expire for a normal gateway. Site secrets stay in env; merchant secrets stay encrypted.

## Consumes

- **`product:email-manager`** (hard `requires`) — `product:payments/*` triggers; never `getMailer()`
- Core `src/core/payments`: online gateway adapter registry (Barion / Stripe / PayPal) / manual + noop for site/dev / FiscalProvider (NAV) / BillingProvider (Billingo, Számlázz.hu)

## Public door

`@/modules/payments/api` (server-oriented door; **no** separate `api.server.ts`). Representative exports: `createCart`, `addCartLine`, `startCheckout`, `getOrderGrossByIds`, `registerPaymentConsumerHook`, `runPaymentConsumerHook`, `PAYMENT_SOURCE_TYPES`, `CONSUMER_SOURCE_DOCS`, money helpers (`majorToMinor`, `formatMoneyMinor`, …), coupon CRUD/apply, merchant helpers, `requestOrderRefund`, `expireAbandonedOnlineCheckouts`, `markOrderPaid`, `verifyAndCaptureOrder`, `registerCollectCapabilityResolver`, `hasCollectCapability`, invoice/fiscal helpers, settings load/save.

```ts
import {
  createCart,
  addCartLine,
  startCheckout,
  registerPaymentConsumerHook,
  PAYMENT_SOURCE_TYPES,
  majorToMinor,
  formatMoneyMinor,
} from '@/modules/payments/api'
```

A second `registerPaymentConsumerHook` on the same key appends. Payments writes the order status before the list runs. The first handler’s throw still fails the request; later listeners are logged and isolated.

## Admin surfaces

- `/admin/payments`, `/admin/payments/orders`, `/admin/payments/orders/[orderId]`, `/admin/payments/invoices`, `/admin/payments/coupons`, `/admin/payments/settings`
- `/admin/payments/merchant`, `/admin/payments/merchants`, `/admin/payments/merchants/[merchantId]`
- ACL areas: `payments`, `payments-merchant`
- Dashboard: `payments.sales`

## Boot and jobs

No dedicated `boot.ts`. Gateway registration via Core `register-online.ts` imports. `expireAbandonedOnlineCheckouts` is called by consumers (e.g. Events abandoned-checkout sweep). Fiscal outbox processing lives in the store path.

## Known gaps

- ASN currency / token ledger → Hero, not `sf_pay_*`
- Shop / ads source types appear on the overview card when those packs ship
- `sf_pay_collect_entitlements` stays a frozen stub

## Tests

`src/modules/payments/checkout-expiry.test.ts`, `sales-by-source.test.ts`, `consumer-hooks.test.ts`, `merchant-methods.test.ts` (plus `src/core/payments/credential-schema.test.ts`, `registry.test.ts` in `test:unit`)
