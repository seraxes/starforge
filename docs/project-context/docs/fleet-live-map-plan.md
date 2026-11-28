---
kind: history
last_verified: 2026-11-28
---
# Fleet live positions — adapter plan

**Status:** Proposed. **Parked** with `product:fleet`. Do not scaffold Fleet or code adapters from this plan.  
**Action plan:** [fleet-live-map-action-plan](./fleet-live-map-action-plan.md).  
**Map product:** [maps-product-plan](./maps-product-plan.md). Decision: [2026-11-28-maps-vs-tacmap](./decisions/2026-11-28-maps-vs-tacmap.md) (accepted; supersedes [2026-11-28-fleet-live-positions](./decisions/2026-11-28-fleet-live-positions.md)).  
**Pack:** [fleet-pack-plan](./fleet-pack-plan.md) · [fleet-build-spec](./fleet-build-spec.md).

## Problem

Courier ops need “where is this car” on a map. Positions come from telematics boxes and, when a car has no box, from a phone.

| Source | Role today | In Starforge |
| --- | --- | --- |
| **Ecofleet** (Fleet Complete) | Hardware in vans (`Api/Vehicles/getLastData`) | Docs only — no adapter |
| **Mtrack** (ITBinder) | Alternate telematics (REST/JSON; OpenAPI not public) | No references in repo |
| **Phone GPS** | Browser geolocation | Shipped on Maps event rooms (consent + same-team). A follow-set phone path is Maps-native, not a Fleet table |

PrimeOne `PollService` page reload is not GPS.

## Constraint

Fleet owns vehicles and telematics adapters. **Maps** owns the map record, last-known positions, and the live UI. Adapters push into Maps through `@/modules/maps/api.server`. A browser session cannot post a vehicle id.

When this slice ships, Fleet `optionalRequires` Maps. Maps does not `requires` Fleet.

## Architecture

```text
Ecofleet poll ─┐
Mtrack poll   ─┼─► Fleet adapter ─► Maps trackable (vehicle id) ─► Maps follow map
               │                      RealtimePort + MapProvider tiles
Phone GPS ─────┴─► Maps ingest (consent). Not a Fleet position row.
```

| Piece | Owner |
| --- | --- |
| Vehicle, plate, vendor object id binding | Fleet |
| Ecofleet / Mtrack poll job, secrets | Fleet (env / encrypted credentials) |
| Last-known lat/lng, source, observed time | Maps trackable |
| Follow map UI (`/admin/maps`, staff deep-link from Fleet) | Maps |
| Depot / station pins | A Maps record of station coordinates. Fleet supplies the address; Maps geocodes via MapProvider |
| Event TacMap mode | Separate Maps record. Courier dots do not land on it |

One last-known point per vehicle for the live map. History and trails stay out of the first slices.

### Ecofleet

Poll `Api/Vehicles/getLastData` (optional `objectId` or plate). Map the object to a Fleet vehicle, then upsert the Maps trackable. `getRawData` / `getTrips` are later, not required for live dots.

### Mtrack

Same adapter contract after ops supplies the OpenAPI and credentials. No second position store.

## Display

Staff with Fleet operations access open a **Maps** follow record that lists those vehicles. TacMap mode on that record is off unless someone turns it on for that record only. Stale markers follow the Maps stale window (telematics may use a longer window than the ~90s phone window).

## Explicit non-goals

| Out | Why |
| --- | --- |
| Fleet-owned live map UI | Maps owns the map |
| Writing cars onto an event room | Separate map records |
| `product:tracking` | Only if a second product needs the same store |
| Importing Ecofleet history on day one | Last-known first |
| Coding while Fleet is parked | Live map queue |

## Related

- [fleet-live-map-action-plan](./fleet-live-map-action-plan.md)
- [maps-product-plan](./maps-product-plan.md)
- [primeone-inventory-fleet](./primeone-inventory-fleet.md)
- [architecture-current](./architecture-current.md)
