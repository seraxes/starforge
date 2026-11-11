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
- Event **Pricing** card: base price, currency, one time-left rule and one sold-count rule (amount or % of the price in effect). Ticket types: own price (replaces the event base when set) plus a modifier that is always added. Optional `priceLabel` overrides the card text; checkout uses the calculated amount. Registration-form option / checkbox `priceAmount` adds on at checkout. Forms is a required dependency; `event-registration` is seeded when Events admin opens.
- Waitlist: per-event toggle; Join waitlist on sold-out cards; FIFO promote when a registered seat frees; Email Manager seed for `product:events/waitlist-promoted` (Events settings → Seed registration emails + form)
- ICS download; View ACL + listed / access password; ticket types per-event (shortDescription blurb)
- **Paid tickets (closed loop):** priced tiers hold as `pending_payment`, hand off to Payments `/[locale]/checkout/[orderId]` (gateway redirect or offline instructions). Form submit and one-click Register both return that same-origin path. On paid → `registered` + `product:events/registered`; on fail/expire/refund → `cancelled`. Checkout start failure cancels the hold. Free / waitlisted tiers stay immediate. See [`payment-bridge.ts`](./payment-bridge.ts).
- **Registrant CSV export** (admin): one event via `/api/admin/events/registrants/export?eventId=` — same list/statuses as Registrants (`registered` / `waitlisted` / `pending_payment` / `cancelled`); columns name, email, ticket type, guests, status, paid amount (Payments order gross when `paymentOrderId` is set)

## Missing / next

### Visibility (later)

| Gate | Intent |
| --- | --- |
| **Association / team / club** | Later — membership source on `AccessViewer` (new tag kind or enriched `groupIds`); no Events-only UI until that source exists |

### Organizer ops

- Calendar subscribe feed (ICS collection)
- Public manage-my-signup (cancel/edit)
- Check-in: manual list, plus automatic when the attendee reaches a GPS point (geofence on the venue/event pin) or comes within range of a Bluetooth beacon paired to the event
- Event categories (beyond featured flag)
- Sports / championship bracket views (later under Events → sport module)
- Per-event prevent-duplicate override
- Manager write ACL (assignments filter list today; writes still need `admin.events`)
- Helper vs manager capability split
- Abandoned online checkout sweeper (pending_payment until provider webhook today)

### Boundary

Slot kinds are choosable: **Ticket type**, **Booking type**, **Faction**, plus names an admin adds. That chooser is decided and not built. Code today is only `general | faction`. Milsim sheets, association membership, and TEÁOR stay Hero data. Do not add those columns to `sf_events_*`. Do not build the chooser ahead of the commercial order in [architecture-current](../../../docs/project-context/docs/architecture-current.md).

### Deferred by design

- Full RRULE / series
- AI “Draft description” (`LlmProvider`)
- Deposit / token pay — **Hero** ASN currency, not an Events price rule. Events keeps real-money ticket prices; Hero may later cover part or all of a selected event.

### Payments (consume — system-wide)

Paid tickets consume shared **`product:payments`** via [`payment-bridge.ts`](./payment-bridge.ts) — not an Events checkout UI. Buyer handoff is Payments public checkout. Receipts: Email Manager `product:payments/*`. Seat confirmation mail: `product:events/registered` after paid (or immediately for free/waitlist). See [payments-cart-plan](../../../docs/project-context/docs/payments-cart-plan.md) and `sf-payments-module`.

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
