# product:events

Events + venues + registration + ticket tiers + parties (`sf_venues` / `sf_events` / …).

## Shipped

- Admin: list (Add+ collapsed → filters → EB-style table) → `/admin/events/[id]` card mosaic (Apply / Save / Cancel)
- **Recurring (finite series):** Recurring card on **Add +** and **edit** — daily / weekly / monthly with count or until-date. Expands once into concrete `sf_events` rows linked by `seriesId` (own capacity/registrants). Edit expand copies ticket types onto extra dates. Registration windows shift with each start. Pattern stored on the series root. Already-linked dates show series summary (read-only). Not a live RRULE engine; group edit across dates is later. Duplicate on the edit toolbar stays a one-off copy.
- Venues: same Add+/table pattern; description (Rich Editor), gallery, Leaflet pin picker via product:maps
- Parties, ticket tiers, registrants, manual door check-in, module settings
- Registration window (`registrationOpensAt` / `ClosesAt`), prevent-duplicate setting
- **Self-service my registration:** `/[locale]/events/[slug]/registration` + account list `/[locale]/account/events`. Organizer sets `cancellationClosesAt` (empty = no self-cancel / Switch-to) and optional `selfCancelRefund` (confirmed refund request via Payments stub — not auto). Free cancel frees the seat + waitlist promote. Paid cancel always cancels the seat; refund only when flag + user confirm. Ticket cards: current tier **Edit / Cancel**; other open unpaid tiers **Switch to**.
- **Door check-in (Premium organizer):** `/admin/events/check-in` — search by name, or scan the attendee QR (deep-links `?eventId=&registrationId=` and focuses Check in). Stores `checkedInAt` on `sf_event_registrations`; shown on Registrants list. Confirmed seats show a QR on **My registration** and signed public ticket `/[locale]/events/ticket/[id]?t=` (email `{{ticketUrl}}`). GPS geofence / Bluetooth beacon later (also Premium). Organizer premium (`product:subscriptions` `events.manage`) opens `/admin/events` the same as ACL `admin.events`.
- **Member / group ticket price:** optional `memberPrice` + `groupPrices` on tiers. Checkout and `quoteTierMajor` call `resolveAudience` from Subscriptions (player premium / plan group ids). Public card still shows the default price label.
- Public **hub** (`/[locale]/events`): four clean views only — Upcoming (cards) / Calendar / Map / List (`?view=`). Category chips filter those views (`?category=`). Not a mega-page with side widgets.
- **Categories** (`/admin/events/categories`): editorial labels with a slug, translatable title and description (content-locale files `events/{id}.json`), custom viewing ACL, and a Forms registration form. Events in the category use that form unless the event picks another. Category ACL is an extra gate on top of the event’s own tags. Unpublished categories stay off the hub.
- Layout **particles** (place anywhere): `event-featured` (rotating carousel of `featured` events), `event-mini-calendar`, `event-calendar`, `event-upcoming`, `event-list` (table), `event-detail`, `event-countdown`
- Event flag **Featured** (admin Visibility) feeds the featured particle only. It is not a category.
- Calendar cells: title, seats `occupied/capacity`, venue; optional thumbnails (`?thumbs=1` on hub, or particle cog)
- Public **detail** sections: header/badges, quick actions, description, details, ticket / faction **area cards** (Register one-click from profile), location (+ map), parties, gallery. Registration uses the event’s form, else the category’s form, else Forms `event-registration`
- Area-card Register: session + complete contact → instant signup for that tier; gaps / terms / captcha → form prefilled (`?tier=`); guests → login with return
- Event **Pricing** card: base price, currency, time-left bands (shortest matching window wins) and one sold-count rule (amount or % of the price in effect). Ticket types: own price (replaces the event base when set) plus one modifier field (`500` amount, `10%` percent). Optional `priceLabel` overrides the card text; checkout uses `quoteTierMajor`. Registration-form option / checkbox `priceAmount` adds on at checkout. Forms is a required dependency; `event-registration` is seeded when Events admin opens.
- Waitlist: per-event toggle; Join waitlist on sold-out cards; FIFO promote when a registered seat frees; Email Manager seed for `product:events/waitlist-promoted` (Events settings → Seed registration emails + form)
- **Require approval** (per event, off by default): a signup that would be `registered` lands as `pending` and holds the seat until an admin sets it registered (Registrants → Approve, or the status field). Paid tiers still hold as `pending_payment` until paid, then `pending` when the gate is on. Waitlist join and FIFO promote to `registered` stay as they are. `product:events/registered`, the attendee reminder, and the door QR wait until `registered`. Organizers get `organizer-notify` while the row is pending.
- **Registration emails (Email Manager):** seeds + `emitEmailTrigger` for `product:events/registered`, `waitlist-promoted`, `organizer-notify` (event managers), `attendee-reminder` (JobRunner ~24h before `startsAt`), and `registrant-cancelled`. Signup stays one-to-few; admin **Email registrants** on the Registrants toolbar queues a paced broadcast (`enqueueEmailBroadcast`, `sourceKey` `events:<eventId>`) for `registered` rows only — never `getMailer()` from Events.
- ICS download; View ACL + listed / access password; ticket types per-event (shortDescription blurb)
- **Paid tickets (closed loop):** priced tiers hold as `pending_payment`, hand off to Payments `/[locale]/checkout/[orderId]` (gateway redirect or offline instructions). Form submit and one-click Register both return that same-origin path. On paid → `registered`, or `pending` when the event requires approval; on fail/expire/refund → `cancelled`. Checkout start failure cancels the hold. Free / waitlisted tiers stay immediate. See [`payment-bridge.ts`](./payment-bridge.ts).
- **Abandoned online checkout:** a JobRunner sweep (`events.abandoned-checkout-sweep`, at boot and about once a minute) asks Payments to expire Barion / Stripe / PayPal orders still open after `checkoutTtlMinutes`. The existing payment hook then cancels that `pending_payment` row and promotes the waitlist. Pay at entrance, cash, and bank transfer stay `awaiting_offline` until staff mark them paid. A hold that never received an order id is cancelled the same way after that TTL. Paid orders are left as they are.
- **Registrant CSV export** (admin): one event via `/api/admin/events/registrants/export?eventId=` — same list/statuses as Registrants (`registered` / `pending` / `waitlisted` / `pending_payment` / `cancelled`); columns name, email, ticket type, guests, status, paid amount (Payments order gross when `paymentOrderId` is set)

## Missing / next

### Visibility (later)

| Gate | Intent |
| --- | --- |
| **Association / team / club** | Later — membership source on `AccessViewer` (new tag kind or enriched `groupIds`); no Events-only UI until that source exists |

### Organizer ops

- Calendar subscribe feed (ICS collection)
- Check-in: GPS geofence (venue/event pin) and Bluetooth beacon auto check-in (Premium; name + QR shipped)
- Sports / championship bracket views (later under Events → sport module)
- Per-event prevent-duplicate override
- Manager write ACL (assignments filter list today; writes still need `admin.events`)
- Helper vs manager capability split

### Boundary

Slot kinds are choosable: **Ticket type**, **Booking type**, **Faction**, plus names an admin adds. That chooser is decided and not built. Code today is only `general | faction`. Milsim sheets, association membership, and TEÁOR stay Hero data. Do not add those columns to `sf_events_*` or turn event categories into them. Do not build the chooser ahead of the commercial order in [architecture-current](../../../docs/project-context/docs/architecture-current.md).

### Deferred by design

- Live RRULE evaluation / infinite background generate; per-date price overrides; group edit scopes (this / following / all) on the edit toolbar
- AI “Draft description” (`LlmProvider`)
- Deposit / token pay — **Hero** ASN currency, not an Events price rule. Events keeps real-money ticket prices; Hero may later cover part or all of a selected event.

### Payments (consume — system-wide)

Paid tickets consume shared **`product:payments`** via [`payment-bridge.ts`](./payment-bridge.ts) — not an Events checkout UI. Buyer handoff is Payments public checkout. Receipts: Email Manager `product:payments/*`. Seat confirmation mail: `product:events/registered` after paid (or immediately for free/waitlist; after admin approval when that gate is on). **Coupons:** Payments owns codes (`/admin/payments/coupons`); Events only collects/forwards `couponCode` on registration / quick-register — never apply discounts in `quoteTierMajor`. See [payments-cart-plan](../../../docs/project-context/docs/payments-cart-plan.md) and `sf-payments-module`.

## Migrations

- `0013` event `featured` boolean (+ index)
- `0016` ticket tier `short_description`
- `0019` tier `price` + `price_modifier`; event `waitlist_enabled`
- `0021` registration `payment_order_id`
- `0028` registration `checked_in_at`
- Coupons: Payments migration `0029_pay_coupons` — run `npm run db:migrate`
- `0030` event `cancellation_closes_at` + `self_cancel_refund` (self-service cancel / Switch-to)
- `0031` event `cover_media_ids` + `cover_display_mode` (Premium random/rotate UI; public playback later)
- `0032` `sf_event_categories` + event `category_id` + `registration_form_id`
- `0033` event `price_rules.time` is a list of time-left bands (sold stays one rule)
- `0034` event `require_approval` (optional signup approval gate)
- `0036` Subscriptions `sf_sub_plans` / `sf_sub_periods` (product:subscriptions)
- `0037` tier `member_price` + `group_prices` (player-premium audience pricing)
- `0040` event `series_id` + `series_pattern` (finite recurring create)

## Migrations (history)

- `0004` venues/events → `0010` listed + access password hash (`0008` reg window, `0009` people/parties)
- `0011` venue `description` + `gallery_media_ids`
- `0013` event `featured`
- `0016` ticket tier `short_description`

Run: `npm run db:migrate` (or `db:core:push`).
