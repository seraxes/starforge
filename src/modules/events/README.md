# product:events

Events + venues + registration + ticket tiers + parties (`sf_venues` / `sf_events` / …).

## Shipped

- Admin: list → `/admin/events/[id]` editor (stacked sections, Save / Duplicate / Delete)
- Venues, parties, ticket tiers, registrants, module settings
- Registration window (`registrationOpensAt` / `ClosesAt`), prevent-duplicate setting
- Public list/detail, Forms `event-registration`, Email Manager trigger
- ICS download (`/api/events/:idOrSlug/ics`), `event-countdown` particle
- Signup note + terms URL on the public form
- Managers/helpers via **group** refs; organizers/speakers/sponsors via **parties**

## Payments (deferred — system-wide)

Commerce is **not** owned by Events. Gateways, currency, PayPal, numeric prices, coupons, early-bird / late fee wait on a future site-level **`product:payments`** module. Ticket tiers keep display-only `priceLabel` until then. Do not add per-event payment method UI here.

## Migrations

- `0004` venues/events → `0009` people/parties (+ `0008` registration window)

Run: `npm run db:migrate` (or `db:core:push`).
