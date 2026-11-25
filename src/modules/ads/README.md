# product:ads

Layer: advanced

Status: catalog + admin (`defaultEnabled: false`; slice 2 — [ads-pack-plan](../../../docs/project-context/docs/ads-pack-plan.md))

Ad packages, credit balances, placements, and campaigns. Payments moves money. Social owns the feed surface the ad appears on. Forms owns intake schemas. Email Manager owns mail. Media owns creative files. Subscriptions gates who may buy (`advertisement` subjects).

Hard `requires`: `product:social`, `product:email-manager`, `product:forms`, `product:subscriptions`, `product:payments`. `optionalRequires`: `product:media` (creatives via MediaPicker / `mediaId`).

## Owns

- Ad packages (`sf_ads_packages`) — sellable SKUs / credit bundles; price major units for later Payments snapshot
- Credit balances stub (`sf_ads_credits`) — per-buyer balance (grant on paid comes later)
- Placements (`sf_ads_placements`) — where a creative may appear (`key`, e.g. `social_feed`)
- Campaigns (`sf_ads_campaigns`) — buyer, package, placement(s), schedule, creative `mediaId` + copy, status (`draft` | `pending` | `live` | `offline`); `socialPostId` null until Social publish
- Admin `/admin/ads` (packages, placements, campaigns)
- ACL area `admin.ads` (view / edit / manage)

## Consumes

- **`product:payments`** — cart, coupons, invoices; line `sourceModule=ads` + paid / expire / refund hooks (**not in this slice**)
- **`product:social`** — publish / take-down of the member-visible ad card via `@/modules/social/api.server` (**not in this slice**); no parallel Ads feed
- **`product:email-manager`** — `emitEmailTrigger` + starters; never `getMailer()` (**later**)
- **`product:forms`** — advertiser intake definition id; Forms owns field schemas (**later**)
- **`product:subscriptions`** — `hasEntitlement` / `resolveAudience` for advertisement subjects (**later**)
- **`product:media`** (`optionalRequires`) — creatives via MediaPicker / `mediaId`; bytes stay in Media
- **Core ACL** — `admin.ads`; staff bypass additive per `sf-staff-bypass`

## Public door

Door ids: `ads-api` → `@/modules/ads/api`, `ads-api-server` → `@/modules/ads/api.server`.

```ts
import { ADS_MODULE_ID } from '@/modules/ads/api'
// server catalog reads:
import { listPackages, findPackageById } from '@/modules/ads/api.server'
```

Server door exports package / placement / campaign / credit reads. No checkout or Social publish exports yet. Cross-pack callers use this door only; private `store` / `schema` / `actions` stay inside the pack.

## Admin

| Surface | Path |
| --- | --- |
| Packages | `/admin/ads` |
| Placements | `/admin/ads/placements` |
| Campaigns | `/admin/ads/campaigns` (CRUD without go-live) |

ACL: `admin.ads` (view / edit / manage). App admin bypasses. Nav from the Ads manifest. Creative field uses MediaPicker when Media is enabled; otherwise a text `mediaId` with a note.

Deep-links (later slices): coupons → `/admin/payments/coupons`, mail → `/admin/email`, forms → `/admin/forms/[id]`.

## Boot

None in this slice. Planned: `registerPaymentConsumerHook` (`ads.*`) from pack boot when Payments bridge ships.

## Known gaps

- Payments bridge (quote, cart, consumer hook) — slice 3
- Social publish / take-down — slice 4
- Email + Forms starters — slice 5
- Subscriptions advertisement gate — slice 6
- Out of scope: Shop SKUs, Marketplace listings, Stream, parallel Ads feed, cart/gateway inside Ads

## Tests

Registered in `test:unit`: `src/modules/ads/catalog.test.ts` — package create validation success + failure (empty title, negative price); placement key validation.
