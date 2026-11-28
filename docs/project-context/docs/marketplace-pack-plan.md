---
kind: reference
last_verified: 2026-11-27
---
# product:marketplace — pack plan

**Status:** Slices 1–10 (local loop) are in tree. Social feed share is in tree. Live map: [architecture-current](./architecture-current.md).  
**Model:** Facebook Marketplace as a **local classifieds board** (create a listing, browse nearby, message, offer, meet, rate). Not Facebook Shops, and not Shop.  
**Placement:** Advanced module (`product:marketplace`). Not Core. Not base. Hard `requires`: Payments, Profiles, Media, Email Manager. `optionalRequires`: Social, Subscriptions. `sf_marketplace_categories`, `sf_marketplace_listings`, `sf_marketplace_saves`, `sf_marketplace_inquiries`, `sf_marketplace_messages`, `sf_marketplace_offers`, and `sf_marketplace_ratings` are in tree; dashboard `marketplace.listings` counts active / new7d / pending; optional listing fee via Payments hook `marketplace.listingFeePaid` (default off); Social feed share via `publishActivity` (`sourceModule=product:marketplace`, listing id, `listing.shared`); public routes `/marketplace` (+ new / you / [id] / edit); settings document `product:marketplace` lives in `sf_module_settings`.  
**Principle:** Never rebuild an existing module’s job ([modular-core](../principles/modular-core.md), [sf-module-ownership](../../../.cursor/rules/sf-module-ownership.mdc), [sf-payments-module](../../../.cursor/rules/sf-payments-module.mdc)).

Facebook’s own help and the March 2026 product note are the feature source: [sell an item](https://www.facebook.com/help/iphone-app/561376580709359), [sort and filter](https://www.facebook.com/help/fblite/248514105820200), [save](https://www.facebook.com/help/904464579676902), [make an offer](https://www.facebook.com/help/196733038830912), [ratings](https://www.facebook.com/help/915385548593204), [shipping labels](https://www.facebook.com/help/376859780413203), [Meta AI tools (2026-03-12)](https://about.fb.com/news/2026/03/facebook-marketplace-new-meta-ai-tools-make-selling-faster-and-easier/).

## What Facebook Marketplace is

A public listing anyone on Marketplace can see. The core loop is local: photo, price, area, then a message or an offer, then meet in person. Shipping and prepaid labels exist for some sellers and are a second loop. Ratings exist for buyers and sellers. Meta AI (draft from photos, availability auto-reply, profile summary) shipped in 2026 on top of that loop. Boosting a listing is paid distribution, not the classified itself.

Starforge copies the local loop. Shipping, labels, AI, and boosts stay out of the first slices and land on the packs that already own them.

## Feature map

| Facebook surface | Starforge home | When |
| --- | --- | --- |
| Create one item: photos, title, price or free, category, condition (new / used / refurbished), description, public area | **Marketplace** listing | First commerce schema |
| Multiple-quantity listing | **Marketplace** | Later. v1 is one item. |
| Vehicle, home for sale/rent, jobs, services | **Marketplace** listing types + **Forms** for the extra fields | Later. v1 has no vertical attribute sheets. |
| Camera / library photos and video | **Media** (`mediaId`, MediaPicker). Video waits on Media’s ffmpeg path. | Photos in v1 |
| Seller name, avatar, member since | **Profiles** (`getPersonas`). Do not copy persona columns. | v1 |
| Browse, search text, category, price range, condition, distance, sort by distance or newest or price | **Marketplace** query | v1 |
| “Today’s picks” ranking | — | Out. v1 sorts by distance and recency. |
| Approximate area on the public page; no home address | **Marketplace** (label + coordinates for distance; street address is not public) | v1 |
| Map of listings | **Maps** only if a later public door can draw pins. TacMap rooms are not a classifieds map. | Later. v1 distance is computed on the listing coordinates. |
| Save listing | **Marketplace** | v1 |
| Saved-search and price-drop alerts | **Notifications** (parked) | After Notifications. v1 saves the row and does not alert. |
| “Is this available?” and a listing thread | **Marketplace** inquiry: one thread per (listing, buyer) | v1. This is not `product:chat`. |
| Make offer, accept, decline (local only on Facebook) | **Marketplace** offer on that inquiry. Accept does not charge the item price. | v1 |
| Mark available / pending / sold, hide, delete, renew | **Marketplace** listing status | v1 |
| Buyer and seller ratings | **Marketplace** ratings. Public after 5 eligible ratings, matching Facebook’s threshold. | v1, after inquiries |
| Rate without a verified deal (Facebook does not check that a purchase happened) | **Not copied.** A rating is eligible only after the seller marks the listing sold to that buyer, or after an accepted offer between that pair. | Decided in this plan |
| In-app checkout of the item, prepaid label, weight and dimensions, seller-paid shipping | **Shop** quotes shipping. **Payments** charges. Marketplace never owns shipping math. | After Shop. v1 is meet in person. |
| Listing fee to publish | **Marketplace** price rule + **Payments** line `sourceModule=product:marketplace`, `sourceType=listing`, hook `marketplace.listingFeePaid` | Slice after the free local loop. **Default off.** |
| Boost / promote listing | **Ads** (placement) or **Subscriptions** (highlight plan). Same Payments cart. | After those packs are in play. Not a Marketplace product table. |
| Share listing into Feed, cross-post to a buy/sell group | **Social** public door. Social off → no feed card. Comments and likes stay in Social. | After the local loop |
| Report a listing | **Social** reports. Today every report row requires a `postId`. Do not add `sf_marketplace_reports`. Until Social can target a listing, staff hide/remove on the Marketplace admin is the moderation tool. A feed share is reported as that Social post. | Door extension later; not a new pack |
| Commerce policies / prohibited items | **Marketplace** admin: disable a category; staff remove a listing. ASN gear rules and commission text | Hero seed and copy, not a second policy engine |
| AI draft title, price, description from photos; AI availability reply; AI profile blurb | Optional **LlmProvider** later. Not v1. | Parked behind the local loop |
| Seller insights (views) | **Marketplace** counter on the listing | Small; may ride with the schema slice |

## Ownership

| Owns | Consumes |
| --- | --- |
| Listing, category tree, save, inquiry thread, offer, rating, listing status, optional listing-fee quote | **payments** — only the optional publish fee (and later a boost that this pack does not own). Item price is a displayed number for a private deal. |
| | **profiles** — seller label and avatar |
| | **media** — listing photos |
| | **email-manager** — `emitEmailTrigger` for new inquiry, offer received, offer accepted. Never `getMailer()`. |
| | **social** (optional) — feed share; reports stay on Social’s post |
| | **subscriptions** (optional) — highlight entitlement. No plan tables here. |
| | **Core ACL** — `admin.marketplace`. Staff bypass is additive (`sf-staff-bypass`). |

**Rule of thumb:** Marketplace decides what is listed, who may message about it, and whether a rating counts. Payments moves a fee. Profiles is the person. Media is the file. Social is the feed and the report queue. Shop is shipping. Chat, when it exists, is unscoped DM — it does not replace the listing inquiry.

## Proposed product rules

1. **Local handoff.** The buyer and seller agree a price in the inquiry. They meet and pay each other. Marketplace does not capture that payment.
2. **Listing-scoped inbox.** One inquiry per listing and buyer. Messages are text plus the structured actions “ask if available” and “offer”. Photos in the thread wait for Media on messages. This inbox is not a DM product: no friend graph, no group chat, no calls. When `product:chat` ships it may carry the same thread; Marketplace still owns the offer and the sold-to link.
3. **Public place, coarse location.** The public listing shows an area label and distance. Coordinates exist for sort and radius. A street address is not a public field. Meetup tips are generic module copy; ASN-specific safety text is content-locale or Hero.
4. **Ratings are tied to a handoff.** Eligible raters are the two users on a sold-to link or an accepted offer. Each direction (buyer rates seller, seller rates buyer) is one row. The average is public once that user has 5 eligible ratings. Staff may hide a rating. Launch scope still migrates marketplace user ratings into this table; posts stay a later examination ([migration-users-events](../../ops/migration-users-events.md)).
5. **Free to list.** A listing fee is a setting, default off. When on, publish calls Payments and the listing stays draft until `marketplace.listingFeePaid`. Coupons stay in Payments.
6. **Categories are site data.** Admin edits a generic tree (name, parent, enabled, sort). Airsoft taxonomy and any commission schedule are Hero seeds on that tree, not columns on `sf_events_*` or `sf_pay_*`.
7. **Listings expire.** A site setting (default 30 days) sets `expiresAt`. Renew sets a new window. Expired listings leave the public query.

## Catalog shape (decision level — no tables yet)

Exact `sf_marketplace_*` columns land in the schema slice. Concepts:

| Concept | Role |
| --- | --- |
| **Category** | Admin tree. A disabled category hides its listings from the public query. |
| **Listing** | Seller, category, title, description, price in minor units or free, condition, status (`draft`, `active`, `pending`, `sold`, `hidden`, `removed`, `expired`), area label, coordinates, `expiresAt`, optional `soldToUserId`, ordered `mediaId`s. |
| **Save** | Buyer + listing. |
| **Inquiry** | Listing + buyer. Unique pair. |
| **Message** | Inquiry + author + body. System rows cover “ask if available”. |
| **Offer** | Inquiry + amount in minor units + status (`open`, `accepted`, `declined`). One open offer at a time. Local only. |
| **Rating** | From user, to user, listing, direction, score, optional note, hidden flag. |

Cross-pack ids are plain text. Do not foreign-key another pack’s tables.

## Public door

`@/modules/marketplace/api` and `api.server`. Door ids: `marketplace-api`, `marketplace-api-server`. Export: `runMarketplaceDoor`. Off → `{ ok: false, reason: 'disabled' }`.

In tree (slice 4): public listing query, one listing read, seller create/edit, pending / sold / renew / hide. Staff overrides via `isAppAdmin` or `admin.marketplace` edit.

In tree (slice 9): optional fee quote via `@/modules/payments/api` (`sourceModule=product:marketplace`, `sourceType=listing`); `registerPaymentConsumerHook('marketplace.listingFeePaid')` from boot. In tree (slice 10): seller “Share to feed” via `loadModuleDoor('social-api-server')` → `publishActivity` (unique source key; Social off fails closed; no advanced→advanced import).

Callers outside the pack use this door only.

## Routes and admin

| Surface | Path |
| --- | --- |
| Browse | `/marketplace` (slice 4) |
| Listing | `/marketplace/[id]` (slice 4) |
| Create / edit | `/marketplace/new`, `/marketplace/[id]/edit` (slice 4) |
| Your listings + saves | `/marketplace/you` (slice 5). Inquiries/offers on listing detail (slice 6). |
| Pack admin | `/admin/marketplace` — categories, listings moderation + `/admin/marketplace/listings/[id]` staff editor (stays in admin), settings (expiry days, photo cap, offers default, listing fee on/off with a deep link to Payments) |
| ACL | `marketplace` → `admin.marketplace` view / edit / manage. App admin bypasses. |
| Dashboard | Existing `marketplace.listings` card. Replace the unavailable stub with active, new-7d, and pending counts (slice 8). |

Admin chrome copies Events / Page Settings (`sf-ui-design.mdc`). New selects on a `useActionState` form are controlled or remounted (`sf-admin-form-defaults.mdc`). Editor-typed category names use Localization’s content-locale path when that control already exists for siblings; chrome strings go in the module message pack.

## Slice order

Coding slices, files, and tests: [marketplace-build-spec](./marketplace-build-spec.md). One slice per chat. Do not start slice 1 while Social polish is the active lane.

| # | Slice | Lands |
| --- | --- | --- |
| 1 | Door | `requires` + fail-closed door. No tables. |
| 2 | Categories | `sf_marketplace_categories`, content locales, `/admin/marketplace` |
| 3 | Listings and settings | Listing table, status rules, moderation, `sf_module_settings` |
| 4 | Public loop | `/marketplace` browse, create, detail, pending / sold / renew |
| 5 | Saves | Save / unsave on `/marketplace/you` |
| 6 | Inquiries and offers | Thread, offer, Email Manager triggers. No item charge. |
| 7 | Ratings | Handoff required. Public average after 5. |
| 8 | Dashboard counts | Replace the unavailable stub |
| 9 | Listing fee | Payments hook, default off |
| 10 | Social share | One feed card through the Social door |

## Explicit non-goals

| Out | Why |
| --- | --- |
| Item checkout, tax on the item, payouts to the seller | Local private deal. A platform fee is the only Marketplace money, and Payments owns the charge. |
| Shipping rates, labels, tracking | `product:shop` |
| General DM, group chat, calls | `product:chat`, after Marketplace |
| Boost product, banner, feed-ad campaign | `product:ads` or a Subscriptions highlight plan |
| Second feed | Social |
| Report table | Social. Listing rows do not go into `sf_social_reports` until that door grows a non-post target. |
| AI listing writer and auto-reply | Later `LlmProvider` call. Not a Marketplace model host. |
| Vehicle / property / jobs / services sheets | Later listing types. Forms owns those fields if they are intake schemas. |
| ASN category tree, commission copy, gear-photo QA | Hero. QA calls `MediaAnalysisPort` and does not fork Media. |
| ASN currency | Hero. Not a balance on marketplace tables. |
| Notifications bell | Parked `product:notifications` |

## Related

- Live map: [architecture-current](./architecture-current.md)
- Commerce contract: [payments-cart-plan](./payments-cart-plan.md), `src/modules/payments/consumers.md`
- Layers: [platform-module-layers](./platform-module-layers.md)
- ASN inventory (not the queue): [asn-modules-wireframe](./asn-modules-wireframe.md)
- Ratings migration note: [migration-users-events](../../ops/migration-users-events.md)
- Coding slices: [marketplace-build-spec](./marketplace-build-spec.md)
- Stub README: [src/modules/marketplace/README.md](../../../src/modules/marketplace/README.md)
