---
kind: reference
last_verified: 2026-11-27
---
# product:fleet — build spec

**Status:** Spec only. **Parked.** Do not scaffold `src/modules/fleet`, schema, admin UI, or a manifest from this file. Onboarding may proceed; Fleet stays parked. Live map: [architecture-current](./architecture-current.md).  
**Pack plan:** [fleet-pack-plan](./fleet-pack-plan.md). **Family order:** [primeone-pack-plans](./primeone-pack-plans.md) waves **2, 3, 6, 8**.  
**Inventory:** [primeone-inventory-fleet](./primeone-inventory-fleet.md). **Coverage:** [primeone-coverage-plan](./primeone-coverage-plan.md).

## Shared rules

- Joomla stays the system of record until this slice’s reconcile passes.
- Never import passwords. First login sets a new password ([migration-users-events](../../ops/migration-users-events.md)).
- No numeric Joomla group ids. Core ACL only. Staff bypass stays additive ([sf-staff-bypass](../../../.cursor/rules/sf-staff-bypass.mdc)).
- Media owns file bytes. This pack stores `mediaId`. Email Manager owns send. The first shift slice does not add Fleet mail starters (live Fleet has no outbound mailer).
- Book / approve ask Onboarding’s public door. Bookable deny refuses. This pack does not read Onboarding tables, does not hard-require Onboarding, and does not turn Onboarding on. Stations are this pack’s catalog. Onboarding reads them through this door. No new Core port.
- Routes and attendance stay in this pack. Route lines use Core MapProvider. Live car positions are Maps trackables (Fleet adapters push). A shift is not an Events ticket. Cars are not written onto an event room.
- Home-run money stays a figure on the claim until Ledger. Clothing requests stay here with no stock draw until Warehouse.

## Door (name only — scaffold later)

`@/modules/fleet/api`. Door id: `fleet-api`.

Exports to freeze at scaffold: book, approve, cancel a shift; read a shift; list cars for a person; list stations; settings for fact names, sources, and missing-source behavior.

Hard `requires` when scaffolded: Media. `optionalRequires`: Onboarding. `layer: advanced`.

## Slices (one chat each, when unparked)

| # | Slice | Family wave | Done when |
| --- | --- | --- | --- |
| 1 | Scaffold: manifest, empty door, README Owns/Consumes, registry generate. No tables. | 2 | `check:atomic` if the manifest/door lands |
| 2 | Stations, vehicles, access, shifts. Book / approve / cancel. Bookable deny fail-closed. | 2 | One exported week matches before any booking import |
| 3 | Leave, holidays, company rentals, home-run claims, clothing requests, damage, faults, work reports. | 3 | Each record type reconciles on its own export |
| 4 | Inspections: dated checklist, separate from a fault. | 6 | Live `vehicle_logs` stay unused until ops confirms rows |
| 5 | Routes: ordered stops on a shift, drawn with MapProvider. | 8 | No import — absent in Joomla |
| 6 | Attendance: clock-in, clock-out, breaks on that shift. | 8 | No import — absent in Joomla |
| 7 | Live map: depot pins, then last-known position (MapProvider + RealtimePort). | 8 | No import. Live poll-to-reload is not GPS |
| 8 | Later bridges: Documents for vehicle files; Ledger for the home-run figure; Warehouse for clothing stock. | 9–10 | Do not start inside the first build |

## Shifts (slice 2)

One day × one fleet vehicle × one driver.

| Field | Values / rule |
| --- | --- |
| Status | `pending_approval`, `sent`, `accepted`, `accepted_changed`, `accepted_changed_params`, `accepted_no_tour`, `rejected`, `cancelled`, `completed` |
| Driver shift type | `3tour`, `4tour`, `express` |
| Manager-only shift type | `1tour`, `2tour`, `regional`, `regional_city` (live `BookingRulesService`; not on the driver calendar) |
| Access on the booking | `priority` or `secondary` (vehicle access row, not a Joomla group) |
| Starts | Requested start, confirmed start. Grid 04:00–09:00, step 15 minutes. Driver-created 4-hour only through 06:00 inclusive. |
| Horizons | Priority 60 days. Secondary 30 days. Cancel lock 14 days. Lead time 12 hours. Book-for-other skips lead time on create and still cannot book a person the fact map calls not bookable. |

Rules that must survive:

- Priority books as `sent` and locks the day. Secondary books as `pending_approval` and does not lock the day.
- One pending request per vehicle per day.
- `accepted*` is dispatcher confirmation, not who may book the car.
- A rented day cannot be booked.
- Leave blocks a new occupying booking. It does not cancel one already there.
- A driver who leaves active keeps an occupying booking.

### Stations and vehicles (same slice)

| Record | Fields (decision level) |
| --- | --- |
| Station | Short name, title, address, published, ordering. Contacts: role `dispatcher` \| `supervisor`, name, phone, email. No lat/lng until the live-map slice. |
| Vehicle | Depot, plate, make, model, VIN, release date, notes, status `available` \| `service` \| `unavailable`, fuel-card fields, car-phone fields, coordinator. |
| Vehicle access | User id + `priority` \| `secondary`. |
| Vehicle file | `registration` or `insurance` as a Media id on the car until Documents. |
| Own vehicle | Singleton coordinator + managers. Not a bookable fleet car. |
| Vehicle managers | Linked user, name, phone, email. |

## Operational records (slice 3)

| Record | Fields (decision level) | Import |
| --- | --- | --- |
| Leave | User id + date. No status enum. | Yes, after a date-list reconcile |
| Holiday | Kind `annual` \| `once` \| `easter` (offsets −2 / 1 / 50 on the live site) | Yes |
| Rental company | Name, published | Yes |
| Rental | Vehicle, company, date, label, note. Blocks that calendar cell. | Yes |
| Home-run claim | One per booking. Took user, return user, return date, km, free km, rate (live default 120), status `pending` \| `approved` \| `denied`. Figure stays on the claim. | Yes |
| Clothing / equipment type | Category `clothing` \| `equipment`, title, sizes | Yes |
| Item request | User, type, size, quantity, status `requested` \| `ordered` \| `handed_over` \| `rejected`. No stock draw. | Yes |
| Damage | User, vehicle, booking, date, amount. Files `report` \| `photo` as Media ids. No status machine. | Yes |
| Fault / service issue | Vehicle, type (`missing_phone`, `faulty_phone`, `missing_fuel_card`, `adblue`, `check_engine`, `accident`, `other`), status `submitted` \| `in_progress` \| `done`, files as Media ids. | Yes |
| Work report | User, body, same status trio, photos as Media ids. | Yes |

Home-run **allow** and **free km** are Onboarding facts. Active Drivers writes them through the fact map. This slice stores the claim only.

## Inspections (slice 4)

Dated checklist on a vehicle: time, odometer km, notes, photos as Media ids. A checklist is not a fault. Live `#__primeone_fleet_vehicle_logs` and `_vehicle_photos` have no PHP writer — usage is **unknown (ops)**. Do not import those tables until ops confirms the rows are real inspections.

## Routes, attendance, live map (slices 5–7)

| Slice | Build | Import |
| --- | --- | --- |
| Routes | Ordered stops on an existing shift. No route without a shift. Draw with MapProvider. | None — not in `com_primeone_fleet` |
| Attendance | Actual start, end, and breaks on that shift. No clock-in that is not a fleet shift. | None |
| Live map | Depot pins on a Maps record (geocode station address), then last-known vehicle positions pushed into Maps. Ecofleet / Mtrack adapters — [fleet-live-map-plan](./fleet-live-map-plan.md), [fleet-live-map-action-plan](./fleet-live-map-action-plan.md) (7a–7f). | None. `PollService` page reload is not a map |

External route or clock tools outside this component are **unknown (ops)**. Do not invent an import for them.

## Fact map (consumed, not stored)

| Fact | If Onboarding is off |
| --- | --- |
| Name, email | Still the Core user |
| Phone | Profiles phone |
| Driver code | Blank |
| Station | This pack’s catalog. Not an Onboarding fact |
| Bookable | Vehicle access. No access → deny |
| Home-run allow, free km | Home-run hidden |
| Trainer, Clearquote | Switches hidden |

Writable person facts save back through Onboarding’s public door. Active Drivers edits those facts plus Fleet-owned access, clothing, damage, and service status. There is no Core fact-map port.

## ACL

| Grant | Live action | SF |
| --- | --- | --- |
| Approve a pending booking | `fleet.approve` | `admin.fleet` edit (approve action) |
| Set dispatcher status | `fleet.dispatch` | `admin.fleet` edit (dispatch action) |
| Book for another driver | `fleet.book.any` | `admin.fleet` edit (book-for-other action) |
| Operations screens | `fleet.operations` | `admin.fleet` edit (operations action) |

Opening a staff screen is the grant. Writing checks the action. App admin bypasses. Which live groups hold these actions is **unknown (ops)**.

## Reconcile before booking import (slice 2)

Live exports to match before any booking row is imported:

| Export | Contents | Proof |
| --- | --- | --- |
| CSV grid | Date × vehicle. Cell = driver, depot/time, shift, status, or rental label. | `BookingsModel::buildCsv` |
| XLSX roster | One sheet per station plus a full sheet. Name/id and shift. Statuses limited to `sent` and `accepted*`. | `RosterWorkbook.php` |
| CSV roster | Same roster when XLSX is unavailable. | `RosterWorkbook::csv` |

The component has no import tool. Starforge import for this slice is written only after one exported week matches the new shift grid. Other slice 3 records reconcile on their own exports. Do not migrate OS Services Booking rows (`mod_osb_fleet_overview`, `mod_osb_history`).

## Admin surfaces

| Surface | Path |
| --- | --- |
| Stations | `/admin/fleet/stations` |
| Schedule | Dispatcher grid + driver calendar |
| My tours / leave / holidays | Driver views |
| Vehicles | Inventory, including own-vehicle |
| Inspections / faults / rentals / service | Operational records |
| Active drivers | Writable facts via fact map + Fleet access |
| Routes / clock-in | On the shift |
| Live map | After slice 7 |

## Gaps

| Gap | Disposition |
| --- | --- |
| `accepted_changed_params` and manager-only shift types | In slice 2. Already on the pack plan. |
| Key-out loan (“signed out until Thursday”) | Out of these slices. Pack plan parks it until ops works that way. |
| Fleet booking / approve email | Omit from slice 2. Live code has no mailer. A later slice may add Email Manager starters; this spec does not. |
| Depot lat/lng, routes, clock-in, GPS map | Slices 5–7 (+ live positions 7a–7f on Maps). No import. [fleet-live-map-action-plan](./fleet-live-map-action-plan.md) |
| `vehicle_logs` PHP unused | Slice 4 only after ops confirms. |
| Home-run payout | Ledger later. Figure stays on the claim. |
| Clothing stock quantity | Warehouse later. Requests stay in Fleet. |
| OSB modules and package zips | Drop. |
| Coming up / Analytics pages | Pages over these rows (family wave 7). This pack does not store them. |

## Related

- Pack plan: [fleet-pack-plan](./fleet-pack-plan.md)
- Live GPS sources (proposed): [fleet-live-map-plan](./fleet-live-map-plan.md), [fleet-live-map-action-plan](./fleet-live-map-action-plan.md), [maps-product-plan](./maps-product-plan.md)
- Fact provider: [onboarding-build-spec](./onboarding-build-spec.md)
- Vehicle files later: [documents-build-spec](./documents-build-spec.md)
- Later money / stock: [ledger-pack-plan](./ledger-pack-plan.md), [warehouse-pack-plan](./warehouse-pack-plan.md)
- Live map: [architecture-current](./architecture-current.md)
