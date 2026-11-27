---
kind: reference
last_verified: 2026-11-27
---
# product:marketplace — build spec

**Status:** Slice 4 (public loop) is in tree. Next chat is slice 5 (saves) only. Live map: [architecture-current](./architecture-current.md).  
**Product rules:** [marketplace-pack-plan](./marketplace-pack-plan.md). This file is the coding order. If the two disagree, the pack plan wins on product behavior and this file wins on which chat does the work.

## How to run a slice

One slice per chat. Stop when its checks pass. Do not start the next slice in the same chat.

Every slice:

1. Copy the nearest finished pack, not a new shape. Admin chrome is Events / Page Settings (`sf-ui-design.mdc`). Selects on a `useActionState` form are controlled or remounted (`sf-admin-form-defaults.mdc`).
2. Cross-pack calls go through `@/modules/<id>/api` or `api.server`. Do not import another pack’s `schema`, `store`, or `actions`. Do not add a row to `scripts/module-boundary-allowlist.json`.
3. Register new unit files on the `test:unit` script in `package.json`. Each new behavior gets a success path and a failure path.
4. Manifest, schema, or public-door edits: `npm run modules:generate` if the manifest changed, then `npm run check:atomic`. Do not hand-edit `src/generated`.
5. Schema edits: `npm run db:migrate`. Tables are `sf_marketplace_*` in `src/modules/marketplace/schema.ts`, declared from the manifest `db.schema` the way Ads does. Owner-module `ADD COLUMN` only. No foreign keys to other packs.
6. `npm run lint` and the new `test:unit` files must pass. A UI slice is not done until the changed admin or public flow has been used in the browser (save, and the control still shows the saved value).

Pure rules live in files that do not import `db`, so tests do not need Postgres. Stores call those functions. The enabled flag is injected, same as `runSocialDoor`.

## Shared contracts (do not re-decide per slice)

| Concern | Use |
| --- | --- |
| Pack off | `runMarketplaceDoor(isEnabled, work)` → `{ ok: false, reason: 'disabled' }` and do not run `work`. |
| Category names | Events category path. Extend `buildEventCategoryKey`’s sibling in `src/core/i18n/content-locale-keys.ts`, plus the sync helper beside `syncEventCategoryLocalesToFiles`. Admin field is `LocaleInput`. Read with `pickContentLocaleText`. Do not store `titleLocales` on the row. |
| Listing title and description | Seller text on the row. One language. Not a content-locale file. |
| Photos | `MediaPicker` from `@/modules/media/api`. Store ordered `mediaId`s. Cap from module settings, default 10. |
| Seller label | `getPersonas` from `@/modules/profiles/api`. |
| Settings | `sf_module_settings` document id `product:marketplace`, loaded like Events `settings.ts`. Keys: `expiryDays` (default 30), `photoCap` (default 10), `offersEnabled` (default true), `listingFeeEnabled` (default false), `listingFeeMinor` (default 0). |
| Money | Only slice 9. Item price is a displayed integer in minor units, or free. It is not a Payments line. |
| Mail | `emitEmailTrigger` and `seedEmailStarter` from `@/modules/email-manager/api.server`. Never `getMailer()`. |
| Staff | `viewer.isAppAdmin` or `viewerMayAccessAdminResource(viewer, 'admin.marketplace', 'edit')`. Staff tools stack on top of seller tools. |
| Routes | Manifest `admin.routes` and `publicRoutes`, then generate. Do not add a hand-written page under `src/app` that bypasses the manifest. |

## Slices

### 1. Door

Manifest `requires`: `product:payments`, `product:profiles`, `product:media`, `product:email-manager`. `optionalRequires`: `product:social`, `product:subscriptions`. Leave `defaultEnabled: true` and the dashboard stub in place. `version` bumps to `0.1.0`.

Add `src/modules/marketplace/door.ts` (`runMarketplaceDoor`), `api.ts` (module id + door re-export), `api.server.ts` (`import 'server-only'`, re-export the door). README Owns / Consumes matches the pack plan, with schema still absent.

**Do not** add `schema.ts`, admin routes, or public routes.

**Tests:** `door.test.ts` — on runs `work`; off returns `disabled` and does not call `work`. Register it in `test:unit`.

**Done when:** `npm run lint`, `npm run test:unit` for that file, `npm run check:atomic`.

### 2. Categories

`schema.ts` with `sf_marketplace_categories` only: id, slug, parent id (plain text), enabled, sort order, timestamps. Manifest `db.schema`. Content-locale keys for title and description.

Admin: `/admin/marketplace` category list and edit, Events chrome, `LocaleInput`, bottom-right Save. Nav group `marketplace`, ACL area `marketplace` (already on the stub). Generate routes.

**Do not** add listings, inquiries, or a public page.

**Tests:** category field validation — a titled enabled category is accepted; an empty title is refused. Content-locale key builder — a marketplace category key round-trips; an unknown field is refused.

**Done when:** those tests are on `test:unit`, lint, `check:atomic`, `db:migrate`. In the browser, create a category, save, and confirm the name is still the one just saved.

### 3. Listings and settings

Add `sf_marketplace_listings`: seller user id, category id, title, description, `priceMinor` (null means free), condition `new` | `used` | `refurbished`, status `draft` | `active` | `pending` | `sold` | `hidden` | `removed` | `expired`, area label, latitude, longitude, `expiresAt`, `soldToUserId`, ordered media ids, timestamps.

`listing-rules.ts` (no `db`):

- Create requires a non-empty title, a condition in that set, and a price that is null or an integer ≥ 0.
- More than `photoCap` media ids is refused.
- Public query includes `active` only, category enabled, `expiresAt` in the future.
- Seller may edit `draft` and `active`. Seller may move `active` → `pending` → `sold` and may renew (`expiresAt` = now + `expiryDays`). Seller may hide their own.
- Staff may hide, remove, and restore any status.
- A member who is not the seller and not staff is refused.

Settings document as in the shared table. Admin: `/admin/marketplace/listings` (moderation list) and `/admin/marketplace/settings`. Fee switch is visible and saved, and it does not call Payments in this slice.

**Do not** add browse pages, saves, inquiries, ratings, or a cart line.

**Tests:** each rule above has a pass and a refuse. Unknown condition refused. Eleventh photo refused when the cap is 10. Non-owner edit refused. Staff hide of someone else’s active listing allowed.

**Done when:** tests, lint, `check:atomic`, migrate. Browser: save settings, change expiry days, confirm the select stays on the saved value. Staff hide on a fixture listing if one can be created from the admin form in this slice; if the admin form is list-only, the rule test covers hide.

### 4. Public loop

Manifest `publicRoutes`:

| Path | Page |
| --- | --- |
| `marketplace` | Browse |
| `marketplace/new` | Create (signed-in) |
| `marketplace/you` | Seller’s listings (shell; saves and inquiries come later) |
| `marketplace/[id]` | Detail |
| `marketplace/[id]/edit` | Edit |

Browse filters: text, category, price min/max, condition, distance from a viewer point, sort `distance` | `newest` | `price`. Distance is a pure haversine on the listing coordinates. A listing with no coordinates is omitted from a distance sort and still appears on newest and price. The public page shows the area label and distance, not a street address.

Create and edit use MediaPicker. Mark pending, sold (optional `soldToUserId`), and renew call the slice 3 rules. Module off: routes render the same fail-closed empty state other packs use when their door returns `disabled`.

**Do not** add offers, ratings, shipping, or a feed share.

**Tests:** haversine of a point to itself is 0; a null coordinate is excluded from distance sort. Public predicate matches the slice 3 status rule (active + unexpired only).

**Done when:** tests, lint, generate, `check:atomic`. Browser: create a listing with a photo, see it on `/marketplace`, open it, mark it pending, renew an expired one.

### 5. Saves

`sf_marketplace_saves`: user id + listing id, unique pair. Save and unsave on the detail page. `/marketplace/you` lists saves. Saving a listing the public predicate rejects is refused. A second save of the same pair is a no-op success, not a second row.

**Tests:** save of a non-public listing is refused; unique pair does not duplicate.

**Done when:** tests, lint, migrate, `check:atomic`. Browser: save, see it under You, unsave.

### 6. Inquiries and offers

`sf_marketplace_inquiries`: listing id + buyer user id, unique pair. `sf_marketplace_messages`: inquiry id, author user id, body, kind `text` | `availability`. `sf_marketplace_offers`: inquiry id, `amountMinor`, status `open` | `accepted` | `declined`. One open offer per inquiry.

`offer-rules.ts`:

- Offers are refused when `offersEnabled` is false.
- Buyer on that inquiry may open an offer with an integer ≥ 0. A second open offer is refused.
- Seller may accept or decline the open offer. Accept does not write a Payments row. Accept may set `soldToUserId` to the buyer and status `sold` in the same transaction.
- A non-participant cannot post.

“Ask if available” inserts one `availability` message.

Mail, caught so a send failure does not roll back the row: `product:marketplace/inquiry.created`, `product:marketplace/offer.received`, `product:marketplace/offer.accepted`. Seed starters from settings the way Events seeds theirs. Deep link to `/admin/email`.

**Do not** build a general DM, group thread, or call. Do not charge the offer amount.

**Tests:** second open offer refused; accept does not require a Payments call (the rule result has no cart line); stranger post refused; offers refused when the setting is off.

**Done when:** tests, lint, migrate, `check:atomic`. Browser: buyer asks and offers, seller accepts, listing shows sold to that buyer.

### 7. Ratings

`sf_marketplace_ratings`: from user, to user, listing id, direction `buyer_rates_seller` | `seller_rates_buyer`, score 1–5, note, hidden. Unique on (from, listing, direction).

`rating-rules.ts`:

- Eligible only when `soldToUserId` is the other party, or an accepted offer on that listing joins the same pair.
- Score outside 1–5 is refused. A second rating in the same direction for the same listing is refused.
- The public average is null until 5 non-hidden ratings exist for that user. Staff may hide a rating.

Show the average on the seller block of the detail page when it is public. Migration of old-site ratings stays TODO until an export exists; this table is the destination named in [migration-users-events](../../ops/migration-users-events.md).

**Tests:** a rating with no handoff is refused; score 0 is refused; the average stays null at 4 and appears at 5.

**Done when:** tests, lint, migrate, `check:atomic`. Browser: after a sold handoff, submit a rating and confirm a fourth rating still shows no public average.

### 8. Dashboard counts

`loadMarketplaceListingsStats` reads the listing table: `active` (public predicate), `new7d` (created in seven days and not `removed`), `pending`. Module off or query failure returns `ok: false`, `status: 'unavailable'` — the card keeps “—”, not zeros.

**Tests:** a fixture set of statuses maps to the three counts; an unavailable result does not become zeros (pure mapper).

**Done when:** tests and lint. Browser: the admin dashboard Marketplace card shows numbers when the pack is on, and “—” when stats are unavailable.

### 9. Listing fee

When `listingFeeEnabled` is false, publish does not call Payments and an `active` listing from slice 4 still works.

When it is true, a new listing stays `draft` until `marketplace.listingFeePaid`. Quote server-side from `listingFeeMinor`. Cart line via `@/modules/payments/api`: `sourceModule` `product:marketplace`, `sourceType` `listing`, stable source id. Register `registerPaymentConsumerHook('marketplace.listingFeePaid')` from the pack boot. Hook on `paid` sets that listing `active` inside the existing payments transaction rules (idempotent: a second paid event does not create a second listing). `expired` / `failed` leave it `draft`. `refunded` moves it to `hidden`. Coupons stay in Payments. Settings deep-link to `/admin/payments`.

**Do not** charge the item price. Do not add a coupon table.

**Tests:** fee off skips the cart; fee on refuses to mark `active` before the hook; a second `paid` is a no-op; `refunded` hides.

**Done when:** tests, lint, `check:atomic`. Browser: with the fee off, publish still works; with the fee on, the draft stays draft until a paid hook (the hook test covers the flip if checkout cannot be completed locally).

### 10. Social share

Optional. A seller action “Share to feed” calls `@/modules/social/api.server` to create one post keyed by `sourceModule=product:marketplace` plus the listing id, so a repeat is an update, not a second post. Social off or the door `disabled`: the action returns fail-closed and no Marketplace table changes. Comments and likes stay on that post. Do not add `sf_marketplace_reports`. Do not write `sf_social_*` from this pack except through the Social door.

**Tests:** Social disabled does not call the write; a second share uses the same source key.

**Done when:** tests, lint, `check:atomic`. Browser: with Social on, share once and confirm a second click does not add a second card.

## First chat

Slice 1 only. Do not add tables, listings, or admin pages.

## Related

- Pack plan: [marketplace-pack-plan](./marketplace-pack-plan.md)
- Live map: [architecture-current](./architecture-current.md)
- Events category locales: `src/core/i18n/content-locale-keys.ts`, `src/modules/events/categories.ts`
- Off door: `src/modules/social/door.ts`
- Payments consumer row: `src/modules/payments/consumers.md`
