---
kind: history
last_verified: 2026-11-28
---
# product:maps — product plan

**Status:** Proposed. Live rooms and venue pins are already in tree. Follow sets, vehicle trackables, and TacMap edit layers are not. Do not start those slices ahead of the live map queue.  
**Action plan:** [maps-tacmap-action-plan](./maps-tacmap-action-plan.md).  
**Decision (accepted):** [2026-11-28-maps-vs-tacmap](./decisions/2026-11-28-maps-vs-tacmap.md).  
**Shipped event rooms:** [maps-live-tactical](./maps-live-tactical.md).  
**Venue pins:** [maps-location-plan](./maps-location-plan.md).

## One product

Manifest id stays `product:maps`. Product name is **Maps**. Class is advanced (`requires` Media). Do not rename the id.

**TacMap** is a mode on one map record. Turning it on adds layers and editing on that record. Turning it off leaves the follow/track map. TacMap is not a second pack, admin area, particle family, or Hero module.

| Layer | Owns |
| --- | --- |
| **Maps** | Map engine, trackables, follow sets, phone ingest, live UI, TacMap mode (image overlays, icons, labels, lines, shapes, zones) |
| **Hero (ASN)** | Milsim skin, beacon SKUs, Capacitor field app, ASN copy. Calls Maps APIs |

| | Default mode | TacMap mode on that map |
| --- | --- | --- |
| Follow trackables | yes | yes |
| Shipped point / KML pins | visible (read) | visible |
| Draw/edit extra layers | no | yes |

## Map records

A courier follow map and an event room are two Maps records. They do not share one canvas. TacMap mode is stored on the record, so event overlays do not appear on a fleet follow map.

Today’s shipped record is the event room (`sf_map_rooms` and related tables). Follow-set records land in a later slice. Until then, same-team roster ACL stays as built.

## Follow sets

Maps stores a **follow set**: selected trackable ids, and optionally one **Core group id**. Core owns users and groups. Maps does not create a second group catalog.

| Trackable | Id |
| --- | --- |
| Phone / user | Core user id |
| People in a group | Core group id on the follow set; members resolved at read time |
| Vehicle | Fleet vehicle id, only when Fleet is on and has pushed a binding |

## ACL

The server decides who may see a position before a marker is sent. Fail closed.

| Audience | Who may read | How a position arrives |
| --- | --- | --- |
| Phone on a follow set | Members of that follow set, plus Maps staff (`admin.maps`) | Signed-in user, explicit consent (Join), then ingest |
| Event room (shipped) | Same-team roster, room owner/admin | Join + `map:room:{roomId}:team:{teamId}` |
| Vehicle | Follow set that includes that vehicle, plus Fleet/Maps staff who may operate that fleet | Fleet adapter only. A browser session cannot post a vehicle id |
| TacMap layers | Same readers as that map record | Map owner/admin; staff bypass stays additive |

Consent: Join starts publish; Leave stops it and clears or stales the position. Do not log raw high-precision coordinates.

## Existing overlays

Point and KML rows already stored on a room stay visible in default mode. TacMap mode adds draw/edit and the extra layer types. Do not hide shipped overlays behind the mode flag.

## Independence

Maps works with no Fleet and no Events. Hard `requires` stays **Media**.

| Optional pack | When it is on |
| --- | --- |
| **Events** | May bind a map record (catalog, roster seed, event embed). TacMap mode does not require the bind |
| **Fleet** | Owns vehicles and Ecofleet/Mtrack adapters. Adapters call the Maps server door. Fleet `optionalRequires` Maps. Maps never `requires` Fleet. Staff open the map in Maps; Fleet may deep-link. No second live-map UI |

Depot coordinates can be a Maps record of station points with no moving dots.

Phone GPS for a follow set is Maps-native. It does not need Fleet.

## TacMap mode scope

**First build (T1), on that map record:** georeferenced image overlays, icons, labels / POIs, lines, shapes, friendly/enemy zones. Edit tools appear only when the mode is on.

**Parked after T1:** stations, hold-to-capture, BLE, command hierarchy, orders, props, game modes. ASN command chrome, if built later, is Hero on the same APIs.

## Social live shares

Everyone / friends / selected live shares in [maps-location-plan](./maps-location-plan.md) stay parked. They do not get a second store. Live location is follow sets. Venue pins stay.

## Explicit non-goals

| Out | Why |
| --- | --- |
| Rename id `product:maps` to TacMap | Id stays; TacMap is the mode name |
| Hero module for TacMap | Reusable engine stays in Maps |
| Maps-owned group table | Core groups |
| One canvas mixing courier dots and event overlays | Separate map records |
| Browser post of a vehicle position | Trusted pack door only |
| Parallel share store | Follow sets |
| Hard `requires` Fleet or Events | Maps stands alone |
| T1 stations, BLE, orders, props | Parked |

## Related

- Action plan: [maps-tacmap-action-plan](./maps-tacmap-action-plan.md)
- Decision: [2026-11-28-maps-vs-tacmap](./decisions/2026-11-28-maps-vs-tacmap.md)
- Shipped rooms: [maps-live-tactical](./maps-live-tactical.md)
- Fleet adapters: [fleet-live-map-plan](./fleet-live-map-plan.md)
- Live queue: [architecture-current](./architecture-current.md)
