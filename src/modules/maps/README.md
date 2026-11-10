# product:maps — TacMap (Tactical Maps)

**Short name:** TacMap · **Long name:** Tactical Maps

Map particle + Core `MapProvider` (leaflet-osm) + closed live rooms (event tactical tool).

## v1 — static

- Core port: `src/core/maps` (`getMapProvider`, Nominatim geocode)
- Particle `map` — pins venues that have lat/lng on published upcoming events
- Events venues: optional `latitude` / `longitude` (+ geocode from address in admin)
- Admin `VenueLocationMap` — click/drag pin on Venues create/edit

## TacMap live rooms (closed roster)

Not a social location-share product. Spec: [maps-live-tactical](../../../docs/project-context/docs/maps-live-tactical.md).

- Admin `/admin/maps` — rooms, admins, teams, roster, point/KML overlays
- Particle `live-map` (label **TacMap**) + event detail embed
- Join / Leave session → GPS ingest → RealtimePort `map:room:…:team:…` (same-team only)
- Capacitor background shell: `apps/asn-capacitor` (field client)

## Later

- **Stations / hold-to-capture / BLE beacons** (ASN TacMap sellable kits) wait until Core is finished ([architecture-current](../../../docs/project-context/docs/architecture-current.md)), and they are not ahead of the commercial packs. The room engine stays in this module. ASN chrome, beacon SKUs, and `apps/asn-capacitor` are Hero clients of it. See maps-live-tactical
- Cross-team visibility + finer admin roles
- Trails / freehand overlays
- Mapbox / Google adapters behind the same port
- Generic friends/selected **shares** (separate product mode — see maps-location-plan)
