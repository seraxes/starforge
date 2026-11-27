# product:marketplace

Layer: advanced

Class: advanced — domain product. Hard `requires`: Payments, Profiles, Media, Email Manager. `optionalRequires`: Social, Subscriptions.

Status: slice 4 (public loop) in tree. Saves are slice 5. Design: [marketplace-pack-plan](../../../docs/project-context/docs/marketplace-pack-plan.md). Coding slices: [marketplace-build-spec](../../../docs/project-context/docs/marketplace-build-spec.md).

## Owns

- Fail-closed door (`runMarketplaceDoor`)
- Category tree (`sf_marketplace_categories`: id, slug, parent id, enabled, sort order, timestamps)
- Category title / description via content-locale keys (`marketplace.category.{id}.title|text`) — not `titleLocales` on the row
- Listings (`sf_marketplace_listings`: seller, category id, title, description, priceMinor, condition, status, area, coordinates, expiresAt, soldToUserId, ordered media ids)
- Pure listing rules (`listing-rules.ts`) — create fields, photo cap, public predicate, seller/staff status gates
- Pure browse rules (`browse-rules.ts`) — haversine distance, public filter/sort (distance | newest | price)
- Module settings document `product:marketplace` in `sf_module_settings` (expiryDays, photoCap, offersEnabled, listingFeeEnabled, listingFeeMinor)
- Public routes: `/marketplace`, `/marketplace/new`, `/marketplace/you`, `/marketplace/[id]`, `/marketplace/[id]/edit`
- Dashboard card `marketplace.listings` (soft stub until slice 8)

Save, inquiry, offer, rating, and the optional listing-fee Payments hook are later slices.

## Consumes

- **payments** — site currency for price display; listing-fee cart line in slice 9. Fee switch saves without calling Payments. No second cart. Item price is not a Payments line.
- **profiles** — seller label on detail (`getPersonas`).
- **media** — listing photos via `MediaPicker` from `@/modules/media/api`. No marketplace library.
- **email-manager** — inquiry and offer triggers in slice 6. Never `getMailer()`.
- **social** (optional) — one feed share in slice 10.
- **subscriptions** (optional) — highlight entitlement later. No plan tables here.
- **Core ACL** — `admin.marketplace`. Staff bypass is additive (`sf-staff-bypass`).

## Public door

`@/modules/marketplace/api` and `@/modules/marketplace/api.server`. Door ids: `marketplace-api`, `marketplace-api-server`. Export: `runMarketplaceDoor`. Off → `{ ok: false, reason: 'disabled' }` and `work` does not run. Public pages and member writes gate through the door.

## Public surfaces

| Path | Page |
| --- | --- |
| `/marketplace` | Browse — text, category, price min/max, condition, distance from viewer point, sort distance \| newest \| price. Area label + distance only (no street address). Listings without coordinates are omitted from distance sort. |
| `/marketplace/new` | Create (signed-in). MediaPicker photos. Publishes `active` with `expiresAt` from settings (fee path is slice 9). |
| `/marketplace/you` | Seller’s own listings only. No saves yet. |
| `/marketplace/[id]` | Detail — mark pending, sold (optional soldToUserId), renew, hide. |
| `/marketplace/[id]/edit` | Edit draft / active (seller) or any (staff). |

## Admin surfaces

`/admin/marketplace` — categories. `/admin/marketplace/listings` — staff hide / remove / restore. `/admin/marketplace/settings` — expiry, photo cap, offers, listing-fee switch (Events / Page Settings chrome, bottom-right Save; selects controlled). Nav group `marketplace`. ACL area `marketplace`. App admin and `admin.marketplace` edit/manage may moderate any listing.

## Boot and jobs

None.

## Known gaps

- No saves, inquiries, offers, or ratings (slices 5–7).
- Destination rating table is slice 7 (see ops migration notes).
- Listing-fee Payments hook is slice 9.
- Ads stays parked until after Marketplace.

## Tests

Registered in `test:unit`:

- `door.test.ts` — on runs `work`; off returns `disabled`
- `category-rules.test.ts` — titled enabled accepted; empty title refused
- `category-locale-keys.test.ts` — marketplace category key round-trips; unknown field refused
- `listing-rules.test.ts` — create / photo cap / public predicate / seller vs staff authz (pass + refuse)
- `browse-rules.test.ts` — haversine self = 0; null coords excluded from distance sort; public predicate matches slice 3
