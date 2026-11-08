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
- Public **detail** sections: header/badges, quick actions, description, details, ticket types, location (+ map), parties, gallery; Forms `event-registration`
- ICS download; View ACL + listed / access password; ticket types per-event (display `priceLabel`)

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
- Waitlist on/off + promote emails
- Per-event prevent-duplicate override
- Manager write ACL (assignments filter list today; writes still need `admin.events`)
- Helper vs manager capability split

### Deferred by design

- Payments / numeric prices / coupons (`product:payments`)
- Full RRULE / series
- AI “Draft description” (`LlmProvider`)

## Migrations

- `0013` event `featured` boolean (+ index) — run `npm run db:migrate`

## Payments (deferred — system-wide)

Commerce is a **shared** site module (**`product:payments`**), not owned by Events. Gateways, currency, PayPal, numeric prices, coupons, early-bird / late fee — any product (Events, future shop, etc.) consumes it. Ticket tiers keep display-only `priceLabel` until then. Do not add per-event or per-module payment UIs.

## Migrations (history)

- `0004` venues/events → `0010` listed + access password hash (`0008` reg window, `0009` people/parties)
- `0011` venue `description` + `gallery_media_ids`
- `0013` event `featured`

Run: `npm run db:migrate` (or `db:core:push`).
