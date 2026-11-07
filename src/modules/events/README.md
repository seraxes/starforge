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
- View ACL via `accessTags` (`public` | `registered` | `group:<id>`) on list + detail
- Visibility layers: **listed** (URL-only when off), **accessTags** (groups), optional **access password** (unlock cookie on detail / ICS / signup; `noindex` when unlisted)

## Missing / next

### Visibility (later)

| Gate | Intent |
| --- | --- |
| **Association / team / club** | Later — membership source on `AccessViewer` (new tag kind or enriched `groupIds`); no Events-only UI until that source exists |

### UX

- Create vs edit parity (compact create hides people / signup / terms)
- Sectioned editor IA (Basics → Schedule → People → Registration → Visibility)
- Real gallery picker (`galleryMediaIds` currently always saved as `[]`)

### Organizer ops

- Calendar particle / month view; calendar subscribe feed
- Registrant CSV export
- Public manage-my-signup (cancel/edit)
- Check-in
- Event categories (beyond ACL tags)
- Waitlist on/off + promote emails
- Per-event prevent-duplicate override
- Manager write ACL (assignments filter list today; writes still need `admin.events`)
- Helper vs manager capability split

### Deferred by design

- Payments / numeric prices / coupons (`product:payments`)
- Full RRULE / series
- AI “Draft description” (`LlmProvider`)

## Payments (deferred — system-wide)

Commerce is **not** owned by Events. Gateways, currency, PayPal, numeric prices, coupons, early-bird / late fee wait on a future site-level **`product:payments`** module. Ticket tiers keep display-only `priceLabel` until then. Do not add per-event payment method UI here.

## Migrations

- `0004` venues/events → `0010` listed + access password hash (`0008` reg window, `0009` people/parties)

Run: `npm run db:migrate` (or `db:core:push`).
