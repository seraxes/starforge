---
kind: history
last_verified: 2026-11-28
---
# Maps / TacMap mode — action plan

**Status:** Proposed. **D0 is docs.** M1 and later stay queued behind the live map (Social polish, then Marketplace). Do not start code from this file.  
**Plan:** [maps-product-plan](./maps-product-plan.md).  
**Decision:** [2026-11-28-maps-vs-tacmap](./decisions/2026-11-28-maps-vs-tacmap.md) (accepted).  
**One slice per chat** when a phase is unparked ([AGENTS.md](../../../AGENTS.md)).

## Phases

| Phase | Work | Queue |
| --- | --- | --- |
| **D0** | Product plan, this action plan, accepted decision, ownership rule, cross-links. No schema | Done |
| **M1** | UI copy: product name **Maps**. Per-map **TacMap mode** control. Manifest id unchanged | After the live map allows Maps work |
| **M2** | Trackable + follow set of user ids. Consent ingest. Server ACL. Event-room roster stays until this replaces it on that record | Same queue as M1 |
| **M3** | Follow set may name a Core group id. Optional external ids only when that pack is on | After M2 |
| **M4** | Fleet Ecofleet/Mtrack adapters push through the Maps server door. Fleet `optionalRequires` Maps. Browser cannot post a vehicle id | After Fleet is unparked through shifts ([fleet-live-map-action-plan](./fleet-live-map-action-plan.md)) |
| **T1** | TacMap edit layers on that map record: image overlays, icons, labels/POIs, lines, shapes, zones. Shipped point/KML stay visible in default mode | After M1. Does not wait on Fleet |
| **Later** | Stations, hold, BLE, Hero command chrome | Parked. [maps-live-tactical](./maps-live-tactical.md) |

```text
D0 docs
  └─ when live map allows Maps
       M1 branding + mode flag
         ├─ M2 follow sets (users) ─ M3 Core group id ─ M4 Fleet push (Fleet unparked)
         └─ T1 TacMap edit layers
Later: stations / BLE / Hero chrome
```

## Done for D0

- [maps-product-plan](./maps-product-plan.md) and this file exist.
- Decision is **accepted**. Live map and Maps README name Maps as the owner. The `sf-module-ownership` bullet is still outstanding (rule file was not editable in this session).
- [2026-11-28-fleet-live-positions](./decisions/2026-11-28-fleet-live-positions.md) is **superseded**.
- Open work “Rename `product:maps` to TacMap” is closed on the live map.
- Pack README brands **Maps** and calls TacMap a mode.

## Done for a later code slice

- `npm run lint`, the area’s `test:unit`, and `npm run check:atomic` when a manifest, schema, or public door changes.
- Success-path and failure-path tests for the new behavior (ACL deny, and for M4 a refused browser vehicle post).

## Do not

- Scaffold Fleet from M4 while Fleet is parked.
- Put Ecofleet or Mtrack clients inside `product:maps`. The adapter lives in Fleet and calls the Maps door.
- Hide shipped point/KML overlays until TacMap mode is on.
- Build everyone/friends/selected live shares beside follow sets.
- Treat T1 as the full Ares Alpha game (orders, props, stations, BLE).
