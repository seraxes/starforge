# product:maps

Layer: base (manifest boot tag — not retagged)

Class: advanced — `requires` Media ([2026-11-26-base-vs-advanced](../../../docs/project-context/docs/decisions/2026-11-26-base-vs-advanced.md))

Status: in progress

**Short name:** Maps. Manifest id stays `product:maps`. **TacMap** is a per-map mode (extra layers and editing), not a second product and not a Hero module. Decision (accepted): [2026-11-28-maps-vs-tacmap](../../../docs/project-context/docs/decisions/2026-11-28-maps-vs-tacmap.md).

Map particle + Core `MapProvider` (leaflet-osm) + closed live rooms (event map records). Product plan: [maps-product-plan](../../../docs/project-context/docs/maps-product-plan.md). Shipped rooms: [maps-live-tactical](../../../docs/project-context/docs/maps-live-tactical.md).

## Owns

- Map particle, event live rooms (closed roster), and the room engine: rooms, admins, teams, roster, point/KML overlays; writes `sf_map_*` only — `sf_map_rooms`, `sf_map_room_admins`, `sf_map_teams`, `sf_map_team_members`, `sf_map_sessions`, `sf_map_positions`, `sf_map_overlays`
- Admin `/admin/maps` (+ `/admin/maps/[roomId]`); particles `map` and `live-map` + event detail embed; Join / Leave session → GPS ingest
- `replaceRoomRoster` and roster seeding slot (Events calls in; this pack does not import Events)
- Realtime ACL: `canSubscribeMapChannel` (RealtimePort `map:room:…:team:…`, same-team only)
- Accepted, not shipped yet: follow sets (trackable ids, optional Core group id), last-known positions for those trackables, TacMap mode on a map record. Vehicle positions arrive only through a trusted pack door (Fleet adapters). Maps does not require Fleet. Shipped point/KML overlays stay visible in default mode.

**v1 — static:** Core port `src/core/maps` (`getMapProvider`, Nominatim geocode). Particle `map` pins venues from the event catalog when Events has registered one (`listPublishedVenues`); with no catalog the map stays empty. Admin event labels and “seed roster from event” use that same slot. Seeding calls Events, which calls `replaceRoomRoster`. Events venues: optional `latitude` / `longitude` (+ geocode from address in admin). Admin `VenueLocationMap` — click/drag pin on Venues create/edit.

**Live rooms (shipped):** closed roster — rooms, admins, teams, roster, point/KML overlays; particle `live-map` + event detail embed; Join / Leave → GPS ingest → RealtimePort team channels. Capacitor background shell `apps/asn-capacitor` is a Hero field client of this module. Follow sets and TacMap mode are planned, not in this tree yet.

## Consumes

- **`product:media`** (hard `requires`) — overlays / assets as needed
- Core `MapProvider` / `src/core/maps` (`getMapProvider`, Nominatim geocode)
- Event catalog slot when Events has registered one (`listPublishedVenues`); RealtimePort team channels
- Capacitor shell is Hero — not a module require

## Public door

- `@/modules/maps/api` — `MapView`, `MapViewProps`, `VenueLocationMap`, `VenueLocationMapProps`
- `@/modules/maps/api.server` — `MAP_POSITION_STALE_MS`, `canSubscribeMapChannel`, `createTeam`, `findActiveSession`, `findMapRoomById`, `findMembershipForUserInRoom`, `isPositionStale`, `joinMapSession`, `leaveActiveSessionForUser`, `listEventCatalog`, `listTeamMemberUserIds`, `listTeamPositions`, `listTeamsForRoom`, `mapTeamChannel`, `registerEventCatalog`, `registerRoomRosterSeeder`, `replaceRoomRoster`, `seedRoomRosterFromEvent`, `setTeamMembers`, `upsertPosition`, `userIsRoomManager`, plus related types (`EventCatalog`, `RoomRosterSeedResult`, `RoomRosterSeeder`, `RosterRow`, `RoomRosterTeam`)

## Admin surfaces

- `/admin/maps`, `/admin/maps/[roomId]`
- ACL area: `maps`
- Venue pin UI on Events admin via `VenueLocationMap` (Events consume)

## Boot and jobs

None in this pack. Events `bootEvents` → `ensureEventsMapCatalog` registers the catalog / roster seeder when Events is on. Catalog is not registered while Events is toggled off.

## Known gaps

- Manifest id stays `product:maps`. Do not rename it to TacMap. TacMap is a per-map mode ([maps-product-plan](../../../docs/project-context/docs/maps-product-plan.md))
- Follow sets, trusted vehicle ingest, and TacMap edit layers are planned. They do not jump ahead of Social polish or Marketplace
- Stations / hold-to-capture / BLE beacons stay parked. ASN chrome, beacon SKUs, and `apps/asn-capacitor` are Hero clients
- Cross-team visibility + finer admin roles
- Trails
- Mapbox / Google adapters behind the same port
- Everyone / friends / selected live shares stay parked. Follow sets replace that store ([maps-location-plan](../../../docs/project-context/docs/maps-location-plan.md))

## Tests

`src/modules/maps/channels.test.ts`, `src/modules/maps/event-catalog.test.ts`
