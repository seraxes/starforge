# product:maps

Layer: base (manifest boot tag — not retagged)

Class: advanced — `requires` Media ([2026-11-26-base-vs-advanced](../../../docs/project-context/docs/decisions/2026-11-26-base-vs-advanced.md))

Status: in progress

**Short name:** TacMap · **Long name:** Tactical Maps (product branding). Manifest id stays `product:maps`.

Map particle + Core `MapProvider` (leaflet-osm) + closed live rooms (event tactical tool). Not a social location-share product. Spec: [maps-live-tactical](../../../docs/project-context/docs/maps-live-tactical.md).

## Owns

- Map particle, TacMap live rooms (closed roster), and the room engine: rooms, admins, teams, roster, point/KML overlays; writes `sf_map_*` only — `sf_map_rooms`, `sf_map_room_admins`, `sf_map_teams`, `sf_map_team_members`, `sf_map_sessions`, `sf_map_positions`, `sf_map_overlays`
- Admin `/admin/maps` (+ `/admin/maps/[roomId]`); particles `map` and `live-map` (label **TacMap**) + event detail embed; Join / Leave session → GPS ingest
- `replaceRoomRoster` and roster seeding slot (Events calls in; this pack does not import Events)
- Realtime ACL: `canSubscribeMapChannel` (RealtimePort `map:room:…:team:…`, same-team only)

**v1 — static:** Core port `src/core/maps` (`getMapProvider`, Nominatim geocode). Particle `map` pins venues from the event catalog when Events has registered one (`listPublishedVenues`); with no catalog the map stays empty. TacMap admin event labels and “seed roster from event” use that same slot. Seeding calls Events, which calls `replaceRoomRoster`. Events venues: optional `latitude` / `longitude` (+ geocode from address in admin). Admin `VenueLocationMap` — click/drag pin on Venues create/edit.

**TacMap live rooms:** closed roster — rooms, admins, teams, roster, point/KML overlays; particle `live-map` + event detail embed; Join / Leave → GPS ingest → RealtimePort team channels. Capacitor background shell `apps/asn-capacitor` is a Hero field client of this module.

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

- A later slice may rename id `product:maps` to TacMap for docs/id consistency — **do not rename in this slice**
- Stations / hold-to-capture / BLE beacons (ASN TacMap sellable kits) stay parked. TacMap itself is in progress and does not jump ahead of Social polish or Marketplace. Ads follows Marketplace. Room engine stays here; ASN chrome, beacon SKUs, and `apps/asn-capacitor` are Hero clients
- Cross-team visibility + finer admin roles
- Trails / freehand overlays
- Mapbox / Google adapters behind the same port
- Generic friends/selected **shares** (separate product mode — see maps-location-plan)

## Tests

`src/modules/maps/channels.test.ts`, `src/modules/maps/event-catalog.test.ts`
