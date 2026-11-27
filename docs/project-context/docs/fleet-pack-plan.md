---
kind: reference
last_verified: 2026-11-27
---
# product:fleet — pack plan

**Status:** Proposed. **Parked.** Onboarding is unparked; this pack is not. Live map: [architecture-current](./architecture-current.md). Do not scaffold schema, admin UI, or a manifest from this plan.  
**Placement:** Advanced module (`product:fleet`). Not Core. Not base. Not Hero.  
**Family index:** [primeone-pack-plans](./primeone-pack-plans.md).  
**Principle:** Never rebuild an existing module’s job ([modular-core](../principles/modular-core.md), [sf-module-ownership](../../../.cursor/rules/sf-module-ownership.mdc), [sf-architecture](../../../.cursor/rules/sf-architecture.mdc)).

## Ownership (planned)

| Owns | Consumes |
| --- | --- |
| Stations, vehicles, access, and the **shift** (one day, one fleet vehicle, one driver, one shift) | **media** (vehicle photos / interim vehicle files as `mediaId`) |
| **Routes** — ordered stops on a shift, drawn with MapProvider; 3 / 4 / Express count on the shift | **Core MapProvider** (pins and route drawing — **not** TacMap / `product:maps`) |
| **Attendance** — actual start, end, and breaks on that shift | **Core RealtimePort** (live car positions when they exist) |
| Leave, holidays, company rental / take-home loans, home-run claim, clothing requests (until Warehouse) | **Core fact map** via Onboarding’s provider (`optionalRequires` Onboarding — legal call only) |
| Inspections (dated checklist), faults and damage, service list | **Core ACL** (`admin.fleet`; staff bypass additive) |
| Active-drivers UI editing only writable facts | **documents** (optional later — vehicle files through shared renderer) |
| | **ledger** (optional later — home-run figure may post as a line; not a payout) |
| | **warehouse** (optional later — clothing may draw stock) |

**Rule of thumb:** Fleet owns *stations, cars, and the shift*. Routes and attendance are Fleet records, not separate packs. Book / approve ask the fact map; if Bookable is deny, they refuse. Fleet does not read Onboarding tables, does not hard-require Onboarding, and does not turn Onboarding on.

## Public door (planned)

`@/modules/fleet/api` (and `api.server` if needed). Door id: `fleet-api`.

Planned exports (names indicative; freeze in the scaffold slice):

- Book, approve, cancel a shift
- Read a shift; list cars for a person; list stations
- Create / approve paths that consult the fact map (Bookable deny → refuse)
- Settings load/save (fact names, sources, missing-source behavior)

Cross-pack callers use this door only. Private `store` / `schema` / `actions` stay inside the pack. Does not require Forms.

## Domain shape (decision level — no tables yet)

Exact `sf_fleet_*` shapes land in a later schema slice.

| Concept | Role |
| --- | --- |
| **Station** | Depot catalog. Onboarding stores a station id and reads this list. The person card does not keep a second station table |
| **Vehicle** | Fleet car; access; interim Media ids for files until Documents |
| **Shift** | One day × one vehicle × one driver; status machine; driver types 3 / 4 / Express; manager-only types `1tour`, `2tour`, `regional`, `regional_city` (live PrimeOne) |
| **Route** | Ordered stops on a shift; no route without a shift |
| **Attendance** | Clock-in / out / breaks on that shift; no clock-in that is not a fleet shift |
| **Leave / holiday** | Blocks a new occupying booking; does not cancel one already there |
| **Loan / rental** | Company rental day (unbookable); taking the car home |
| **Home-run claim** | One claim per fleet booking; priority access + home-run fact; two legs. Until Ledger: figure stays on the claim, not a payout |
| **Inspection / fault / service** | Dated checklist (≠ fault); damage; service submitted → in progress → done |

## Shift rules

- Priority books as `sent` and locks the day. Secondary books as `pending_approval` and does not lock the day.
- One pending request per vehicle per day.
- Statuses: `pending_approval`, `sent`, `accepted`, `accepted_changed`, `accepted_changed_params`, `accepted_no_tour`, `rejected`, `cancelled`, `completed` (live `com_primeone_fleet` / `BookingRulesService`).
- `accepted*` is dispatcher confirmation, not who may book the car.
- Start grid 04:00–09:00, step 15 minutes. Driver create: 4-hour only through 06:00 inclusive. Express is its own type.
- Priority horizon 60 days. Secondary horizon 30 days. Cancel lock 14 days. Lead time 12 hours.
- Staff who may book for anyone skip the lead time on create. They still cannot book a person the fact map calls not bookable.
- Leave blocks a new occupying booking. It does not cancel one already there.
- A rented day cannot be booked.
- A driver who leaves active keeps an occupying booking.
- Home run: one claim per fleet booking, priority access plus the home-run fact, two legs.

## Interim until later packs

| Until | Fleet keeps |
| --- | --- |
| Documents | Vehicle files as Media ids on the car |
| Ledger | Home-run figure on the claim (not a payout) |
| Warehouse | Clothing requests here (no stock draw) |

## Admin surfaces and ACL (planned)

| Surface | Path / key |
| --- | --- |
| Stations | `/admin/fleet/stations` |
| Schedule | Dispatcher grid + driver calendar |
| My tours / Workdays | Driver views; leave and holidays |
| All vehicles | Fleet inventory |
| Inspections / Faults / Loans / Service | Operational records |
| Live map | Depot pins, then last-known position (MapProvider + RealtimePort) |
| Active drivers | Edit writable facts only (through fact map) |
| Routes / Clock-in | On the shift |
| ACL area | `fleet` → `admin.fleet` (view / edit / manage). Approve, dispatch, book-for-other, operations. App admin bypasses. |

Staff menus stay additive (`sf-staff-bypass`).

## Slice order (when unparked)

One slice per chat. Stop when that slice’s checks pass. **Do not start schema or admin UI in the plan-only chat.**

1. **Scaffold** — `src/modules/fleet` manifest (`layer: advanced`), hard `requires`: Media; `optionalRequires`: Onboarding; empty public door; README Owns/Consumes; registry generate.
2. **Shifts against the fact map** — book / approve / cancel; Bookable deny fail-closed; match an exported week of real bookings before import.
3. **Leave, rental, home run, holidays, clothing, damage, faults.**
4. **Inspections.**
5. **Routes** on the shift (MapProvider).
6. **Clock-in** (attendance on the shift).
7. **Live map** (depot pins → last-known position).
8. Later bridges: Documents for vehicle files; Ledger for home-run post; Warehouse for clothing draw.

A work order with an assignee, and “keys signed out to this person until Thursday,” wait until someone works that way.

## Explicit non-goals

| Out | Why |
| --- | --- |
| Separate routes or attendance packs | Inside this pack |
| Phases, form answers, training scores | `product:onboarding` |
| Reading Onboarding tables | Fact map only |
| Hard-requiring or auto-enabling Onboarding | `optionalRequires` only |
| TacMap / Events for shifts | MapProvider + Fleet shift; not tickets or tactical rooms |
| PDF template library | Documents (or interim Media ids) |
| Warehouse quantities or money ledger | Later packs |
| Payments / cart / invoices inside Fleet | `product:payments` |
| Starting ahead of Social → Marketplace | Live map |

## Related

- Build spec (parked): [fleet-build-spec](./fleet-build-spec.md)
- Family index: [primeone-pack-plans](./primeone-pack-plans.md)
- Onboarding (fact provider): [onboarding-pack-plan](./onboarding-pack-plan.md)
- Documents: [documents-pack-plan](./documents-pack-plan.md)
- Later: [ledger-pack-plan](./ledger-pack-plan.md), [warehouse-pack-plan](./warehouse-pack-plan.md)
- Live map: [architecture-current](./architecture-current.md)
- Layers: [platform-module-layers](./platform-module-layers.md)
