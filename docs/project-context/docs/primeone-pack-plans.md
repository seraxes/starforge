---
kind: reference
last_verified: 2026-11-27
---
# PrimeOne packs — plan index

**Status:** Onboarding is unparked and runs beside Marketplace. Fleet, Documents, Ledger, and Warehouse stay parked — do not scaffold those. Live map: [architecture-current](./architecture-current.md).  
**Coverage / inventory:** [primeone-coverage-plan](./primeone-coverage-plan.md) — [drivers](./primeone-inventory-drivers.md) · [fleet](./primeone-inventory-fleet.md) · [crosscut](./primeone-inventory-crosscut.md).  
**Build specs:** [onboarding](./onboarding-build-spec.md) (slice 1 in tree) · [fleet](./fleet-build-spec.md) · [documents](./documents-build-spec.md) (Fleet and Documents still parked).  
**Source note:** [primeone-for-claude](../../review/primeone-for-claude.txt) (review draft; these files are the filed shape).  
**Principle:** Never rebuild an existing module’s job ([modular-core](../principles/modular-core.md), [sf-module-ownership](../../../.cursor/rules/sf-module-ownership.mdc), [sf-architecture](../../../.cursor/rules/sf-architecture.mdc)).

## Packs in this family

| Pack | Standing | Plan |
| --- | --- | --- |
| `product:onboarding` | Unparked. Slice 1 door in tree (`defaultEnabled: false`). Training included | [onboarding-pack-plan](./onboarding-pack-plan.md) · [build spec](./onboarding-build-spec.md) |
| `product:fleet` | First build (routes + attendance included) | [fleet-pack-plan](./fleet-pack-plan.md) · [build spec](./fleet-build-spec.md) |
| `product:documents` | First build (shared renderer) | [documents-pack-plan](./documents-pack-plan.md) · [build spec](./documents-build-spec.md) |
| `product:ledger` | Later — not first build | [ledger-pack-plan](./ledger-pack-plan.md) |
| `product:warehouse` | Later — not first build | [warehouse-pack-plan](./warehouse-pack-plan.md) |

## Agreed decisions (shared)

1. **Training** lives inside Onboarding. No separate training pack.
2. **The person is the Core user.** Name and email always come from that user. Onboarding and Fleet do not keep a second copy of the account.
3. **Person facts travel through public doors.** No new Core port. Fleet `optionalRequires` Onboarding and reads phone, driver code, bookable, home-run, trainer, and Clearquote from `@/modules/onboarding/api`. Onboarding `optionalRequires` Fleet and reads the station list from `@/modules/fleet/api`. Neither pack hard-requires the other, turns the other on, or reads the other’s tables.
4. **Bookable** when the user’s Onboarding status is flagged bookable (seeded status `active`) **or** the user has Fleet vehicle access. Onboarding off → vehicle access is enough. Neither → deny. Do not invent a driver.
5. **Routes** and **attendance** live inside Fleet. Route lines use Core MapProvider. Live car positions are Maps trackables ([maps-product-plan](./maps-product-plan.md)). Attendance is clock-in on a Fleet shift.
6. **`product:documents`** is shared: subjects are the Core user, an onboarding record, and a fleet vehicle. Media keeps the bytes. Invoices stay in Payments.
7. **Ledger** and **warehouse** stay later. Not in the first build.
8. **Home, Coming up, and Analytics** are pages. They store nothing.
9. **Hero** owns brand and chrome only — no shifts, phases, or tests.

## Fact map (Fleet reads)

| Fact Fleet shows | PrimeOne source | If Onboarding is off |
| --- | --- | --- |
| Name, email | Core user | Still the user |
| Phone | Onboarding, else Profiles phone | Profiles phone |
| Driver code | Onboarding `driverCode` | Blank |
| Station | Fleet station catalog. Onboarding stores the chosen station id | No station list |
| Bookable | Status flagged bookable, or Fleet vehicle access | Vehicle access. No access → deny |
| Home-run allow, free km | Onboarding | Home-run hidden |
| Trainer, Clearquote | Onboarding, writable from Fleet | Switches hidden |

Writable facts save back through the same provider. Fleet still does not know phases or form rows.

## What Starforge already owns

Do not rebuild: Core users/groups/grants; `product:media` (files); `product:forms` (schemas); `product:email-manager` (`emitEmailTrigger`); `product:profiles` (name, avatar, generic contact); Core MapProvider (map tiles); Core RealtimePort (live push); `product:payments` (checkout, VAT, invoices); `product:events` (public ticketed events — a shift is not a ticket); `product:maps` (the live map — Fleet pushes vehicle positions; cars do not go on an event room).

## Pages, not packs

| Page | Role |
| --- | --- |
| Home | Counts and links for the packs that are on |
| Coming up | Procedure events inside 48 hours, tomorrow’s shifts, open faults, upcoming sittings |
| Analytics | The same rows over a range. No second store |
| Documents list | Links to files the packs already produce, until `product:documents` exists |

## Build order (when unparked)

1. Fact map, then Onboarding identity facts.
2. Fleet shifts. Match an exported week of real bookings before importing any.
3. Fleet records already in use: leave, rental, home run, holidays, clothing, damage, faults.
4. Onboarding procedure and files. Import submissions only after “latest submission, older rows kept” matches the live site.
5. Training inside Onboarding: checklist and PDF, trainer calendar, then a Forms quiz (questions and score live in Forms; Onboarding stores the attempt and the qualification).
6. Valid-until dates, then vehicle inspections.
7. Home and Coming up.
8. Routes on the shift, then clock-in, then the live map.
9. Documents when both a person file and a car file need the same renderer.
10. Ledger or warehouse only when a second caller needs those rows.

Each slice imports its own rows when a reconciliation matches. The current Joomla site stays the system of record for anything not yet cut over. Users set a new password on first login.

## Grants (planned)

| Grant | Pack |
| --- | --- |
| Onboarding staff, trainer, training manager | Onboarding |
| Approve, dispatch, book for another driver, fleet operations | Fleet |
| Documents staff | Documents |
| Later: ledger / warehouse | Those packs |

Opening a page is the grant. Writing checks the action. Pack code does not test legacy numeric group ids. Staff bypass stays additive ([sf-staff-bypass](../../../.cursor/rules/sf-staff-bypass.mdc)).

## Explicit non-goals (family)

| Out | Why |
| --- | --- |
| Separate training / routes / attendance packs | Owned inside Onboarding or Fleet |
| Cars on an event room | Live cars are a separate Maps follow record. Fleet adapters push. [fleet-live-map-plan](./fleet-live-map-plan.md), [maps-product-plan](./maps-product-plan.md) |
| Events for shifts or ride-alongs | A shift is not a ticket; a ride-along is not a public event |
| Parallel form builder, file library, or mailer | Forms / Media / Email Manager |
| Payments inside Fleet | Checkout, VAT, invoices stay in Payments |
| General CRM or report-builder that copies other packs’ rows | Out of scope |
| Migrating old OS Services Booking rows | Not in this plan |
| Hardcoding legacy group ids | Core ACL only |
| Scaffolding Fleet, Documents, Ledger, or Warehouse while they are parked | Live map. Onboarding is the only unparked pack in this family |

## Related

- Coverage plan + inventories: [primeone-coverage-plan](./primeone-coverage-plan.md)
- Build specs: [onboarding](./onboarding-build-spec.md) (slice 1 in tree), [fleet](./fleet-build-spec.md), [documents](./documents-build-spec.md) (still parked)
- Fleet live GPS (proposed): [fleet-live-map-plan](./fleet-live-map-plan.md), [fleet-live-map-action-plan](./fleet-live-map-action-plan.md), [maps-product-plan](./maps-product-plan.md)
- Live map: [architecture-current](./architecture-current.md)
- Layers: [platform-module-layers](./platform-module-layers.md)
- Review draft: [primeone-for-claude](../../review/primeone-for-claude.txt)
