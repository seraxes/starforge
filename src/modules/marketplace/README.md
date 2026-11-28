# product:marketplace

Layer: advanced

Class: advanced — domain product. Hard `requires`: Payments, Profiles, Media, Email Manager. `optionalRequires`: Social, Subscriptions.

Status: slices 1–10 (local loop) in tree. Design: [marketplace-pack-plan](../../../docs/project-context/docs/marketplace-pack-plan.md). Coding slices: [marketplace-build-spec](../../../docs/project-context/docs/marketplace-build-spec.md).

## Owns

- Fail-closed door (`runMarketplaceDoor`)
- Category tree (`sf_marketplace_categories`: id, slug, parent id, enabled, sort order, timestamps)
- Category title / description via content-locale keys (`marketplace.category.{id}.title|text`) — not `titleLocales` on the row
- Listings (`sf_marketplace_listings`: seller, category id, title, description, priceMinor, condition, status, area, coordinates, expiresAt, soldToUserId, ordered media ids)
- Saves (`sf_marketplace_saves`: user id + listing id, unique pair). Second save of the same pair is a no-op success. Non-public listings are refused.
- Inquiries (`sf_marketplace_inquiries`: listing id + buyer user id, unique pair). Listing-scoped thread — not a general DM.
- Messages (`sf_marketplace_messages`: inquiry id, author, body, kind `text` | `availability`). “Ask if available” inserts one availability message.
- Offers (`sf_marketplace_offers`: inquiry id, amountMinor, status `open` | `accepted` | `declined`). One open offer per inquiry. Accept does not charge the amount; may set listing `sold` + `soldToUserId` in the same transaction.
- Ratings (`sf_marketplace_ratings`: from user, to user, listing id, direction `buyer_rates_seller` | `seller_rates_buyer`, score 1–5, note, hidden). Unique `(from, listing, direction)`. Eligible only after sold-to or an accepted offer on that pair. Public average null until 5 non-hidden ratings. Staff may hide. Destination for migrated marketplace user ratings (source map TODO until export).
- Pure listing rules (`listing-rules.ts`) — create fields, photo cap, public predicate, seller/staff status gates
- Pure browse rules (`browse-rules.ts`) — haversine distance, public filter/sort (distance | newest | price)
- Pure save rules (`save-rules.ts`) — public predicate gate + unique-pair no-op
- Pure offer rules (`offer-rules.ts`) — offersEnabled gate, one open offer, participant-only post, accept with no cart line
- Pure rating rules (`rating-rules.ts`) — handoff gate, score 1–5, one per direction, public average threshold, staff hide
- Pure listing-fee rules (`listing-fee-rules.ts`) — fee off skips cart; fee on stays draft until hook; paid / expired / failed / refunded outcomes
- Pure share rules (`share-rules.ts`) — Social off skips the write; source key `(product:marketplace, listingId, listing.shared)` is stable across shares
- Module settings document `product:marketplace` in `sf_module_settings` (expiryDays, photoCap, offersEnabled, listingFeeEnabled, listingFeeMinor)
- Public routes: `/marketplace`, `/marketplace/new`, `/marketplace/you`, `/marketplace/[id]`, `/marketplace/[id]/edit`
- Email Manager starters: `product:marketplace/inquiry.created`, `offer.received`, `offer.accepted` (seed from settings; deep-link `/admin/email`)
- Dashboard card `marketplace.listings` — active (public predicate), new7d (created in 7d, not removed), pending. Module off or query failure → unavailable (“—”, not zeros). Pure fold in `dashboard/marketplace-listings-counts.ts`.
- Optional listing-fee quote + Payments hook `marketplace.listingFeePaid` (default off). Item price is never charged.
- Seller “Share to feed” — one Social activity card via `publishActivity` (no `sf_marketplace_reports`; no direct `sf_social_*` writes).

## Consumes

- **payments** — cart line for the optional publish fee (`sourceModule=product:marketplace`, `sourceType=listing`, stable listing id). Fee quoted server-side from `listingFeeMinor`. Coupons stay in Payments. No second cart. Item price and offer amount are not Payments lines.
- **profiles** — seller label on detail (`getPersonas`).
- **media** — listing photos via `MediaPicker` from `@/modules/media/api`. No marketplace library.
- **email-manager** — `emitEmailTrigger` / `seedEmailStarter` for inquiry and offer mail. Never `getMailer()`. Send failure does not roll back the row.
- **social** (optional) — feed share via `loadModuleDoor('social-api-server')` → `publishActivity` (advanced must not import advanced). Off, missing door, or `disabled` → fail-closed; Marketplace rows unchanged. Comments / likes stay on that Social post. Do not import Social store / schema / actions.
- **subscriptions** (optional) — highlight entitlement later. No plan tables here.
- **Core ACL** — `admin.marketplace`. Staff bypass is additive (`sf-staff-bypass`).

## Public door

`@/modules/marketplace/api` and `@/modules/marketplace/api.server`. Door ids: `marketplace-api`, `marketplace-api-server`. Export: `runMarketplaceDoor`. Off → `{ ok: false, reason: 'disabled' }` and `work` does not run. Public pages and member writes gate through the door. Server door also re-exports listing-fee checkout helpers.

## Public surfaces

| Path | Page |
| --- | --- |
| `/marketplace` | Browse — text, category, price min/max, condition, distance from viewer point, sort distance \| newest \| price. Area label + distance only (no street address). Listings without coordinates are omitted from distance sort. |
| `/marketplace/new` | Create (signed-in). MediaPicker photos. Fee off → `active` with `expiresAt`. Fee on → draft until `marketplace.listingFeePaid`, then checkout. |
| `/marketplace/you` | Seller’s own listings beside saved listings. Unsave from the Saved section. |
| `/marketplace/[id]` | Detail — save / unsave; ask if available; offer; seller accept/decline; rate after handoff; public seller average when ≥5; mark pending, sold, renew, hide; Share to feed (seller/staff). |
| `/marketplace/[id]/edit` | Edit draft / active (seller) or any (staff). |

## Admin surfaces

`/admin/marketplace` — categories. `/admin/marketplace/listings` — staff list (title / Edit → admin editor; hide / remove / restore). `/admin/marketplace/listings/[id]` — staff listing editor (reuses shared `ListingForm` fields; stays under `/admin` — [admin stays in admin](../../../docs/project-context/docs/decisions/2026-11-27-admin-stays-admin.md)). `/admin/marketplace/settings` — expiry, photo cap, offers, listing-fee switch + minor amount (Events / Page Settings chrome, bottom-right Save; selects controlled). Deep-link mail to `/admin/email`, fee checkout to `/admin/payments`. Nav group `marketplace`. ACL area `marketplace`. App admin and `admin.marketplace` edit/manage may moderate any listing. Public `/marketplace/[id]/edit` remains for sellers.

## Boot and jobs

`bootMarketplace` registers `registerPaymentConsumerHook('marketplace.listingFeePaid')`. Hook on `paid` activates the draft listing (idempotent). `expired` / `failed` leave draft. `refunded` → `hidden`.

## Known gaps

- Ratings source-column migration map stays TODO until an export exists ([migration-users-events](../../../docs/ops/migration-users-events.md)).
- Ads stays parked until after Marketplace.
- Social reports still require a `postId`; listing reports wait on a Social door extension. Staff hide/remove remains the moderation tool for unshared listings.

## Tests

Registered in `test:unit`:

- `door.test.ts` — on runs `work`; off returns `disabled`
- `category-rules.test.ts` — titled enabled accepted; empty title refused
- `category-locale-keys.test.ts` — marketplace category key round-trips; unknown field refused
- `listing-rules.test.ts` — create / photo cap / public predicate / seller vs staff authz (pass + refuse)
- `browse-rules.test.ts` — haversine self = 0; null coords excluded from distance sort; public predicate matches slice 3
- `save-rules.test.ts` — non-public save refused; unique pair does not insert a second row
- `offer-rules.test.ts` — second open offer refused; accept has no cart line; stranger post refused; offers refused when offersEnabled is false
- `rating-rules.test.ts` — no handoff refused; score 0 refused; public average null at 4 and set at 5
- `dashboard/marketplace-listings-counts.test.ts` — fixture statuses map to active / new7d / pending; unavailable stays nulls (not zeros)
- `listing-fee-rules.test.ts` — fee off skips cart; fee on stays draft until hook; second paid is a no-op; refunded hides
- `share-rules.test.ts` — Social disabled does not call the write; a second share uses the same source key
