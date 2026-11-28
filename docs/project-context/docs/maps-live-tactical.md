---
kind: history
last_verified: 2026-11-28
---
# Maps — event room and TacMap mode (shipped rooms)

**Layer:** **Modules** (`product:maps`) for rooms / teams / roster / overlays / live ingest / **stations**. **RealtimePort** + **MapProvider** = Core. ASN field chrome + hardware catalog = **Hero**.

**Status:** Event-room domain + live player session (foreground) shipping. Capacitor background shell, stations/hold/beacons stay parked. Follow sets and TacMap edit layers: [maps-product-plan](./maps-product-plan.md).

**Names**

| | |
| --- | --- |
| **Product** | **Maps** |
| **Mode** | **TacMap** — extra layers and editing on one map record. Not a second module |
| **Module id** | `product:maps` (do not rename) |
| **ASN Hero** | Milsim chrome, beacon SKUs, `apps/asn-capacitor`. Does not own TacMap |

## What ships today

Closed **event map record**: owner/admins create **teams**, put **users on a roster**, members **join a session** and share GPS with **same-team only**. This is the current event instance. It stays until follow sets replace roster ACL on that record ([maps-product-plan](./maps-product-plan.md)).

Point and KML overlays already stored on the room stay visible in default mode. TacMap mode, when built, adds draw/edit on that record only.

A courier follow map is a **different** Maps record. Vehicle positions are not written onto this room.

Stations (mission / capture points), hold-to-capture, and BLE beacons stay parked. They are TacMap-mode work after the first edit-layer slice, not a second product.

## Explicit non-goals (shipped / near-term live players)

- Friend / Social / “everyone” location share
- Cross-team visibility matrix (later)
- Fine-grained admin permission levels (later)
- Position history / trails
- Freehand drawing
- Reliable iOS background GPS from browser PWA alone (needs Capacitor)

## Data (`sf_map_*`)

| Table | Role |
| --- | --- |
| `sf_map_rooms` | Event-bound room; `ownerUserId` |
| `sf_map_room_admins` | Owner-appointed admins (roster + overlay) |
| `sf_map_teams` | Teams in a room (optional `ticket_tier_id` seed) |
| `sf_map_team_members` | Explicit roster — **source of truth for who may see whom** |
| `sf_map_sessions` | Join/leave + consent while tracking (players; later station devices) |
| `sf_map_positions` | Last-known position per active session |
| `sf_map_overlays` | Point (`base`/`poi`) + optional KML/KMZ media ref |
| `sf_map_stations` *(planned)* | Mission / capture points in a room |
| `sf_map_station_presence` *(planned)* | Who is in-zone (GPS and/or beacon), for hold timers |
| `sf_map_station_state` *(planned)* | Owner team, capture progress, contested, last change |

Canonical visibility (players): **same team membership**. Ticket tiers may **seed** teams/roster; they do not grant live visibility by themselves.

Station visibility (who sees progress / markers) follows room policy later (same-team only first; cross-team optional later).

## Consent + geolocation

- Join map = explicit opt-in; Leave = stop publish + clear/stale position.
- Permissions-Policy: `geolocation=(self)` (browser Geolocation API).
- Do not log raw high-precision coordinates in app logs.
- Beacon scan: OS Bluetooth permission + in-app consent; presence posts are ACL’d like ingest.

## Realtime

- Ingest via authenticated API; fan-out on RealtimePort channel `map:room:{roomId}:team:{teamId}`.
- Subscribe ACL: roster membership (or room owner/admin).
- Redis pub/sub fanout when `STARFORGE_REALTIME_FANOUT=redis` + `REDIS_URL`.
- Stations later: `map.station.progress` / `map.station.captured` on team (or room) channels.

## Particles / surfaces

- `live-map` particle (layout) + event detail embed when a room exists for the event.
- Admin: `/admin/maps` (rooms, teams, roster, overlays; later stations).

---

## Stations, hold capture, beacons *(parked — TacMap mode, after T1)*

### Product intent (ASN)

Organizers buy / rent **low-power beacons** (and optional station phones) from the ASN shop, bind them on a Maps record with **TacMap mode** on, and place them as **mission / capture points**. Players’ phones share GPS with the team and detect nearby beacons to hold objectives.

| Piece | Layer |
| --- | --- |
| Station / presence / hold engine | **Module** `product:maps` (TacMap mode) |
| Milsim UX, field chrome | **Hero** ASN |
| Beacon SKUs, kits, rental, event bundles | **Hero** + Marketplace/Shop Module |
| Capacitor background GPS + BLE scan | **Client** (`apps/asn-capacitor`) |

Do **not** fork a second map stack for hardware — beacons are presence sources on the same station API.

### Station = mission / capture point

A **station** is not a roster teammate marker. It is an objective on the map:

- Fixed lat/lng (admin-placed), **or**
- A paired **station device** session (phone left at the point), **or**
- A **BLE beacon** id bound to the station (primary ASN sellable SKU)

Players nearby contribute to **hold / capture**.

### Hold-to-capture (example rule)

Default story the product sells:

1. Station has a **geofence radius** (GPS) and/or **beacon proximity** (BLE).
2. One or more roster members of team A are **in zone**.
3. Continuous presence for **N minutes** (e.g. **10**) → station **captured** by team A.
4. Empty zone → progress pauses or decays (config).
5. Both teams in zone → **contested** (no progress / freeze) — configurable.

Configurable fields (station or room defaults):

| Field | Notes |
| --- | --- |
| `radiusM` | GPS geofence |
| `holdSeconds` | e.g. 600 |
| `minPlayers` | optional |
| `contestMode` | freeze / reset / exclusive |
| `presenceSource` | `gps` \| `beacon` \| `either` \| `both` |
| `beaconId` | UUID / iBeacon major-minor / Eddystone — vendor-neutral string |
| `visibleTo` | same-team first; cross-team later |

### Presence sources (unified API)

```text
POST /api/maps/live/{roomId}/stations/{stationId}/presence
  { source: 'gps' | 'beacon', lat?, lng?, beaconId?, accuracy? }
```

Server:

1. Auth + roster (or station device role).
2. Validate in-zone (haversine vs station point, or beaconId match + optional RSSI policy later).
3. Update presence rows; advance hold timer; publish realtime progress.

GPS geofence and beacon detection are **interchangeable inputs** to the same hold engine — so hardware SKUs can ship without a second game mode.

### Low-power beacons

- Field units advertise a stable id; the Capacitor client **scans** (native BLE).
- Beacon ↔ `sf_map_stations.beacon_id` in admin (pair at event setup).
- Does **not** replace teammate GPS on the map; it answers “am I at this objective?”
- Battery: months on coin cell — marketed as an ASN Maps accessory.
- iOS/Android background scan limits → same native shell as background GPS.

### Suggested build order (after live players)

1. **Stations + GPS geofence hold** (no hardware required to demo).
2. **Beacon id binding + scan presence** on the Capacitor client.
3. ASN shop SKUs / kits (“Maps beacon pack”) pointing at setup docs.
4. Contest rules, min players, organizer dashboard (who holds what).
5. Optional: station-phone mode (device Join as `kind: station`).

### Commercial note (ASN)

Marketing copy can say: *ASN Maps + official beacons — drop a point, hold 10 minutes, take the objective.*  
Implementation stays in Maps so other Starforge sites can enable stations without ASN SKUs; only the catalog and milsim chrome are Hero.

---

## Related

- Product plan: [maps-product-plan](./maps-product-plan.md) — follow sets, TacMap mode, separate map records
- [maps-location-plan](./maps-location-plan.md) — venue pins; live social shares stay parked
- Vehicle adapters (Fleet pushes into Maps): [fleet-live-map-plan](./fleet-live-map-plan.md), [2026-11-28-maps-vs-tacmap](./decisions/2026-11-28-maps-vs-tacmap.md)
- [platform-module-layers](./platform-module-layers.md)
- Capacitor shell: `apps/asn-capacitor`
