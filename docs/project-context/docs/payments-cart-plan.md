# Payments cart plan (`product:payments`)

**Status:** Design frozen for implementation (2026-11-08). Commercial order, when product work resumes: this pack’s paid-ticket loop, then subscriptions, then ads. That order waits until Core is finished — [architecture-current](./architecture-current.md). The 5 Nov wireframe does not put Marketplace or Social ahead of it. `sf_pay_collect_entitlements` stays a frozen boolean until subscriptions owns it.  
**Priority:** **Foundational** — revenue floor before Shop.  
**Principle:** Never rebuild an existing module’s job inside a new module ([modular-core](../principles/modular-core.md), [sf-module-ownership](../../../.cursor/rules/sf-module-ownership.mdc), [sf-payments-module](../../../.cursor/rules/sf-payments-module.mdc)).

## Why this pack exists

Starforge must cover commerce **modularly**: one checkout/orders/VAT/gateway engine; domain packs own catalogs and fulfillment. The platform’s revenue strategy floor (must work end-to-end, tested):

1. **Subscriptions** — pay for a plan (incl. highlight / entitlement products later).
2. **Events** — buy tickets / paid registration.
3. **Ads** — pay for packages / credits / campaigns.

**Shop** (SKUs + **shipping**) comes later and is thinner for MVP. **Marketplace** reuses the same payments layer (and often subscriptions for boosts/highlights) — it does not get a second cart.

## Layers

| Layer | Owns |
| --- | --- |
| **Core `src/core/payments/`** | `PaymentsProvider`, `FiscalProvider`, Money helpers, factory, gateway adapters (Barion / Stripe / PayPal / manual), webhook verify |
| **`product:payments`** | Cart, orders, invoices, settings admin, consumer API (`@/modules/payments/api`), Email Manager trigger registration + emit |
| **Consumers** | Priceable sources + fulfillment hooks only — see matrix below |
| **`product:email-manager`** | Rules/templates for `product:payments/*` — transport via Core Mailer |

## Who owns what (commerce)

| Concern | Owner | Payments role |
| --- | --- | --- |
| Cart, checkout, order, payment intent | **payments** | Source of truth |
| VAT lines / minor units on the order | **payments** (+ Core money helpers) | Snapshot at checkout |
| Gateways / webhooks / secrets | **Core payments port** | Adapters only |
| Invoice series / fiscal outbox / NAV | **payments** + **FiscalProvider** | |
| Billing address field schema | **forms** | Link preset; no form builder here |
| Commerce email copy | **email-manager** | `emitEmailTrigger` only |
| Event tier price, seats, waitlist, ticket grant | **events** | Line `sourceModule=events` + paid/expire hooks |
| Plan catalog, period, entitlement, highlight product | **subscriptions** | Charge + snapshot; grant on paid |
| Ad package / credit / campaign rules | **ads** | Same |
| SKU, inventory, **shipping rate/zone/quote** | **shop** (later) | Cart accepts quoted shipping **line** from shop — does not own delivery math |
| Marketplace fee / boost | Marketplace pack (+ subscriptions where applicable) | Same checkout API |
| Premium merchant collect (own keys, Billingo/Számlázz, no % fee) | **payments** merchant mode | See [payments-merchant-plan](./payments-merchant-plan.md) |

**Rule of thumb:** Payments never decides “how much is shipping” or “what does Pro plan include.” Consumers decide; Payments moves money and keeps the fiscal record.

## Build order (commercial)

1. **`product:payments`** Core port + module API (cart, checkout, orders, offline mark-paid, email triggers, fiscal outbox stub).
2. Wire **first consumers** against the same API (order can be parallel once API is stable):
   - Events paid tickets
   - Subscriptions checkout
   - Ads checkout
3. **Shop** later (shipping lives there).
4. Marketplace consumes existing layers — no fork.

Document every new consume edge in the owner README + these rules (continuous ownership map).

## Money / VAT

- Integer **minor units** only; site currency (HUF first).
- Persist net, gross, VAT rate (bps), VAT category, tax country, seller/buyer VAT IDs.
- Paid orders immutable; corrections = credit notes.
- HU NAV: `FiscalProvider` + `sf_pay_fiscal_outbox` from day one; live NAV adapter when credentials exist.

## Methods

Online: Barion, Stripe, PayPal (redirect / hosted; never trust browser amounts).  
Offline: bank transfer, pay at entrance, cash (staff mark-paid audited).

## Email

Emit only via `emitEmailTrigger` — keys `product:payments/checkout_started`, `awaiting_offline`, `paid`, `invoice_issued`, `refunded`, `failed`, `expired`. No commerce SMTP inside Payments.

## Refunds (TODO)

`requestOrderRefund` is a consumer connector stub (`code: 'refunds_not_implemented'`). Still needed: gateway refund, mark order `refunded`, credit notes, email, and `runPaymentConsumerHook(..., 'refunded')`. Consumers (Events) may offer opt-in + confirmed refund requests only — never auto-refund.

## Related

- [platform-module-layers](./platform-module-layers.md)
- [sf-module-ownership](../../../.cursor/rules/sf-module-ownership.mdc)
- Events README § Payments (consumes this pack)
