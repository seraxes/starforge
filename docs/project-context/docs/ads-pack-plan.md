---
kind: reference
last_verified: 2026-11-25
---
# product:ads — pack plan

**Status:** Slice 2 shipped (catalog schema + `/admin/ads`). **Parked** on the live queue until after Social polish and Marketplace (and other major advanced modules). Live map: [architecture-current](./architecture-current.md). Do not start slice 3 (Payments bridge) while parked.  
**Placement:** Advanced module (`product:ads`). Not Core. Not base.  
**Principle:** Never rebuild an existing module’s job ([modular-core](../principles/modular-core.md), [sf-module-ownership](../../../.cursor/rules/sf-module-ownership.mdc), [sf-payments-module](../../../.cursor/rules/sf-payments-module.mdc)). Decisions: [2026-11-22-social-built-parked](./decisions/2026-11-22-social-built-parked.md), [2026-11-22-launch-scope](./decisions/2026-11-22-launch-scope.md).

## Ownership (planned)

| Owns | Consumes |
| --- | --- |
| Ad packages, credit balances, placements, campaign rules, creative binding, go-live / pause / expire policy | **payments** (cart, coupons, invoices; line `sourceModule=ads` + paid / expire / refund hooks) |
| | **social** (an ad posts into Social — no parallel Ads feed) |
| | **email-manager** (`emitEmailTrigger` + starters; never `getMailer()`) |
| | **forms** (intake / advertiser application schemas; Ads picks a definition id) |
| | **subscriptions** (`hasEntitlement` / `resolveAudience` for advertisement subjects; no second plan catalog) |
| | **media** (creatives via MediaPicker / `mediaId`; bytes stay in Media) |
| | **Core ACL** (`admin.ads` area; staff bypass additive per `sf-staff-bypass`) |

**Rule of thumb:** Ads decides *what* is sold and *when* a campaign is live. Payments moves money. Social owns the feed surface the ad appears on. Forms owns field schemas. Email Manager owns mail. Media owns files.

## Public door (planned)

`@/modules/ads/api` (and `api.server` only if the pack needs a server-only split — follow Payments/Subscriptions when scaffolding). Door id: `ads-api`.

Planned exports (names indicative; freeze in the scaffold slice):

- Catalog resolve / quote for checkout (server-side re-resolve; never trust client amounts)
- Checkout start helpers that call `@/modules/payments/api` with `sourceModule=ads`
- Campaign / credit / placement reads for admin and fulfillment
- Social publish helper that only calls `@/modules/social/api.server` (never writes `sf_social_*` from Ads)
- `registerPaymentConsumerHook` registration from boot (`ads.*` hook key)
- Settings load/save; email seed helpers

Cross-pack callers use this door only. Private `store` / `schema` / `actions` stay inside the pack.

## Catalog shape (decision level — no tables yet)

Three product concepts; exact `sf_ads_*` shapes land in a later schema slice:

| Concept | Role |
| --- | --- |
| **Package** | Sellable SKU (fixed price or credit bundle). Price rules live here; Payments snapshots the line. |
| **Credits** | Spendable balance granted on paid (and reversed on refund). Campaigns spend credits or a package allotment — Ads owns the ledger math, not Payments. |
| **Placement** | Where the creative may appear (e.g. Social feed slot, later layout banner particle). Placement policy stays in Ads; rendering in Social / layout consumes Ads via the public door. |

Campaigns bind a buyer, package/credits, placement(s), schedule, and creative (`mediaId` + copy). Do not invent Marketplace listing rank or Shop SKUs inside Ads. Subscriptions may gate *who may buy* (`advertisement` subjects); Ads still owns inventory and go-live.

## Ad → Social post (no parallel feed)

1. Ads **does not** ship a second feed, wall, or discovery list.
2. When a campaign goes live, Ads calls Social’s public server door (`@/modules/social/api.server`) to create or upsert the member-visible card — extend that door if today’s `createPost` / `publishActivity` contracts are not enough; do not import Social `store` / `schema`.
3. Prefer a stable cross-pack key (`sourceModule=product:ads` + campaign / creative id) so republish and take-down are idempotent (same pattern as Social activities).
4. **Social off or disabled:** no feed write. Publish returns fail-closed (`disabled` / equivalent). The campaign must not appear as “live in feed.” Catalog and Payments checkout may still exist; fulfillment that requires a Social post must refuse or stay pending until Social is on.
5. Comments, likes, and reports on that card stay in Social. Ads does not fork engagement tables.

## Checkout + fulfillment (via Payments)

Same consumer contract as Events and Subscriptions ([payments-cart-plan](./payments-cart-plan.md)):

1. Buyer selects a package → Ads quotes → cart line via `@/modules/payments/api` (`sourceModule=ads`, stable `sourceId`).
2. Checkout re-resolves price server-side. Coupons stay in Payments (`couponCode` forward only).
3. Register one Payments consumer hook from Ads boot (`registerPaymentConsumerHook`).
4. Hook outcomes:
   - **paid** — grant credits and/or mark the purchase fulfilled; allow go-live when placement rules pass; then publish into Social.
   - **expire** / **failed** — do not grant; cancel pending purchase; no Social publish.
   - **refunded** — reverse credits / pull the campaign offline; take down or hide the Social card through the Social door (idempotent).
5. Money movement, webhooks, and fulfillment flips use an idempotency key + `db.transaction` on the Payments side; Ads hooks catch/log secondary failures so they do not invent a second cart.

Deep-link coupons → `/admin/payments/coupons`, mail → `/admin/email`, forms → `/admin/forms/[id]`.

## Admin surfaces and ACL (planned)

| Surface | Path / key |
| --- | --- |
| Pack admin | `/admin/ads` (packages, credits, placements, campaigns, settings) |
| ACL area | `ads` → `admin.ads` (view / edit / manage). App admin bypasses. |
| Public | Buyer catalog / campaign manage routes TBD in MVP slices — not a parallel Social feed |
| Layout | Banner / placement particle later; feed ads go through Social first |

Staff menus stay additive (`sf-staff-bypass`). Do not refuse `isAppAdmin` on ownership-gated campaign tools.

## Slice order (first Composer chats after this plan)

One slice per chat. Stop when that slice’s checks pass. **Do not start schema or admin UI in the plan-only chat.**

1. **Scaffold** — `src/modules/ads` manifest (`layer: advanced`), hard `requires`: Social, Email Manager, Forms, Subscriptions, Payments (plus Media if creatives bind in MVP), empty public door, README Owns/Consumes stub, registry generate. No commerce tables yet if the slice is door-only; otherwise minimal schema approved in-chat.
2. **Catalog schema + admin list** — packages / credits / placements at the decided shape; `/admin/ads` chrome matching Events/Subscriptions; ACL `admin.ads`.
3. **Payments bridge** — quote, cart line, checkout start, `registerPaymentConsumerHook` for paid / expire / refund; unit tests success + failure.
4. **Social publish** — go-live → Social door; Social-off fail-closed; take-down on expire/refund; no parallel feed.
5. **Email + Forms** — `product:ads/*` starters via Email Manager; Forms preset / definition link for advertiser intake; deep-links only.
6. **Subscriptions gate** — `hasEntitlement` / advertisement audience checks on buy / go-live; no plan tables under Ads.
7. **Enablement polish** — settings, seeds, `test:unit` registration, `check:atomic` if doors/schema/manifest changed.

## Explicit non-goals

| Out | Why |
| --- | --- |
| **Shop** | SKUs, inventory, and shipping live in `product:shop` (later). Ads is packages / credits / placements, not a storefront. |
| **Marketplace** | C2C listings and listing rank stay with Marketplace (stub today). Ads may later boost via the same Payments layer; it does not own classifieds. |
| **Live video** | Part of Social. No `product:stream`. Ads does not embed a stream product. |
| Parallel Ads feed / wall | Social owns the feed. |
| Cart, gateway, invoice, or coupon engine inside Ads | `product:payments` |
| Field builder or SMTP inside Ads | Forms / Email Manager |
| Creative file store inside Ads | Media |
| Plan / period / entitlement catalog inside Ads | Subscriptions |
| Chat, Notifications, ASN currency | Parked / Hero |

## Related

- Live map: [architecture-current](./architecture-current.md)
- Commerce contract: [payments-cart-plan](./payments-cart-plan.md)
- Subscriptions (advertisement subjects): [subscriptions-pack-plan](./subscriptions-pack-plan.md), `sf-subscriptions-module.mdc`
- Social standing: [social-module-standing](./social-module-standing.md)
- Layers: [platform-module-layers](./platform-module-layers.md)
