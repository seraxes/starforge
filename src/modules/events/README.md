# product:events

Events + venues + registration + ticket tiers + parties (`sf_venues` / `sf_events` / …).

## Shipped

- Admin: list (Add+ collapsed → filters → EB-style table) → `/admin/events/[id]` card mosaic (Apply / Save / Cancel)
- Venues: same Add+/table pattern; description (Rich Editor), gallery, Leaflet pin picker via product:maps
- Parties, ticket tiers, registrants, module settings
- Registration window (`registrationOpensAt` / `ClosesAt`), prevent-duplicate setting
- Public **hub** (`/[locale]/events`): four clean views only — Upcoming (cards) / Calendar / Map / List (`?view=`). Not a mega-page with side widgets.
- Layout **particles** (place anywhere): `event-featured` (rotating carousel of `featured` events), `event-mini-calendar`, `event-calendar`, `event-upcoming`, `event-list` (table), `event-detail`, `event-countdown`
- Event flag **Featured** (admin Visibility) feeds the featured particle — like a category for carousel placement
- Calendar cells: title, seats `occupied/capacity`, venue; optional thumbnails (`?thumbs=1` on hub, or particle cog)
- Public **detail** sections: header/badges, quick actions, description, details, ticket / faction **area cards** (Register one-click from profile), location (+ map), parties, gallery; Forms `event-registration`
- Area-card Register: session + complete contact → instant signup for that tier; gaps / terms / captcha → form prefilled (`?tier=`); guests → login with return
- Tier price: numeric `price` + `priceModifier`; optional `priceLabel` text overrides card display
- Waitlist: per-event toggle; Join waitlist on sold-out cards; FIFO promote when a registered seat frees
- ICS download; View ACL + listed / access password; ticket types per-event (shortDescription blurb)

## Missing / next

### Visibility (later)

| Gate | Intent |
| --- | --- |
| **Association / team / club** | Later — membership source on `AccessViewer` (new tag kind or enriched `groupIds`); no Events-only UI until that source exists |

### Organizer ops

- Calendar subscribe feed (ICS collection)
- Registrant CSV export
- Public manage-my-signup (cancel/edit)
- Check-in
- Event categories (beyond featured flag)
- Sports / championship bracket views (later under Events → sport module)
- Waitlist email template seed (trigger `product:events/waitlist-promoted` already emitted)
- Per-event prevent-duplicate override
- Manager write ACL (assignments filter list today; writes still need `admin.events`)
- Helper vs manager capability split

### Deferred by design

- Full RRULE / series
- AI “Draft description” (`LlmProvider`)

### Payments (consume — system-wide)

Paid tickets consume shared **`product:payments`** via [`payment-bridge.ts`](./payment-bridge.ts) — not an Events checkout UI. Paid tiers create `pending_payment` registrations, then cart/checkout; on paid → `registered`, on fail/expire → `cancelled`. Free tiers keep immediate register. Receipts: Email Manager `product:payments/*`. See [payments-cart-plan](../../../docs/project-context/docs/payments-cart-plan.md) and `sf-payments-module`.

## Migrations

- `0013` event `featured` boolean (+ index)
- `0016` ticket tier `short_description`
- `0019` tier `price` + `price_modifier`; event `waitlist_enabled`
- `0021` registration `payment_order_id` — run `npm run db:migrate`

## Migrations (history)

- `0004` venues/events → `0010` listed + access password hash (`0008` reg window, `0009` people/parties)
- `0011` venue `description` + `gallery_media_ids`
- `0013` event `featured`
- `0016` ticket tier `short_description`

Run: `npm run db:migrate` (or `db:core:push`).
