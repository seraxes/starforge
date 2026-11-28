---
kind: history
last_verified: 2026-11-28
---
# Fleet live positions — action plan

**Status:** Proposed. **Parked** with Fleet. Do not start coding.  
**Plan:** [fleet-live-map-plan](./fleet-live-map-plan.md).  
**Maps phases:** [maps-tacmap-action-plan](./maps-tacmap-action-plan.md) (M4 is this push).  
**Fleet slices 1–6** land before adapter work ([fleet-pack-plan](./fleet-pack-plan.md)).

## Prerequisites

| # | Action | Done when |
| --- | --- | --- |
| P0 | Fleet stays parked until the live map unparks it | [architecture-current](./architecture-current.md) |
| P1 | Fleet slices 1–6 (scaffold through clock-in) | Spec checks green |
| P2 | Ecofleet API key + sample `getLastData` JSON | Key in vault; sample for 1–2 plates |
| P3 | Mtrack OpenAPI + credentials, or an explicit defer note | Spec in vault, or defer written here |
| P4 | Vehicle ↔ vendor object id / plate field | Chosen before the binding slice |
| P5 | Maps follow-set + trusted ingest door exist (Maps M2–M3) | [maps-tacmap-action-plan](./maps-tacmap-action-plan.md) |
| P6 | [2026-11-28-maps-vs-tacmap](./decisions/2026-11-28-maps-vs-tacmap.md) accepted | Done. Ownership rule updated |

## Slices (pack “slice 7”, after P0–P1 and P5)

| Slice | Name | Build |
| --- | --- | --- |
| **7a** | Station coordinates | Fleet station address handed to Maps; Maps geocodes and shows depot pins on a Maps record. No moving dots |
| **7b** | Vehicle binding | Fleet stores vendor object id / plate on the vehicle. No position table in Fleet |
| **7c** | Trusted push | Adapter calls Maps server door; Maps publishes RealtimePort. ACL tests: staff on the follow set can read; a browser post of a vehicle id is refused |
| **7d** | Ecofleet | Job polls `getLastData`, binds, pushes. CI uses fixture JSON, not a live key |
| **7e** | Mtrack | Same contract after P3. Skip with a defer note if the spec is missing |
| **7f** | Phone on a car | Maps phone ingest keyed to a vehicle id the driver is allowed to represent. Omit when every car has a box |

Fleet `optionalRequires` Maps in the slice that first calls the Maps door. Maps does not gain a Fleet `requires`.

## Order

```text
P0–P1 Fleet 1–6
Maps M2–M3 (P5)
  └─ 7a depot pins on a Maps record
       └─ 7b binding → 7c push → 7d Ecofleet
            ├─ 7e Mtrack if P3
            └─ 7f phone-as-vehicle only if a car has no box
```

## Done (MVP)

- Staff open the live map under `/admin/maps` (Fleet may deep-link).
- Depot pins visible.
- At least one telematics source updates last-known positions through RealtimePort.
- Stale cars are marked or hidden.
- Positions are Maps trackables on a follow record, not rows on an event room.
- Lint, area unit tests, and `check:atomic` (if a door or manifest changed) pass.

## Do not

- Scaffold `product:fleet` from this file while parked.
- Put Ecofleet or Mtrack pollers in Core or in `product:maps`.
- Start 7d without fixture JSON.
- Start 7e without vendor OpenAPI or an explicit defer.
- Treat PrimeOne poll-to-reload as a GPS import.

## Related

- [fleet-live-map-plan](./fleet-live-map-plan.md)
- [fleet-pack-plan](./fleet-pack-plan.md)
- [maps-product-plan](./maps-product-plan.md)
- [architecture-current](./architecture-current.md)
