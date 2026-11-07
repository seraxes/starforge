# product:maps

Map particle + Core `MapProvider` (leaflet-osm) + **live tactical rooms** (closed event tool).

## v1 — static

- Core port: `src/core/maps` (`getMapProvider`, Nominatim geocode)
- Particle `map` — pins venues that have lat/lng on published upcoming events
- Events venues: optional `latitude` / `longitude` (+ geocode from address in admin)
- Admin `VenueLocationMap` — click/drag pin on Venues create/edit

## Live tactical (closed roster)

Not a social location-share product. Spec: [maps-live-tactical](../../../docs/project-context/docs/maps-live-tactical.md).

- Admin `/admin/maps` — rooms, admins, teams, roster, point/KML overlays
- Particle `live-map` + event detail embed
- Join / Leave session → GPS ingest → RealtimePort `map:room:…:team:…` (same-team only)
- Capacitor background shell: `apps/asn-capacitor` (field client)

## Later

- **Stations / hold-to-capture / BLE beacons** (ASN **TacMap** sellable kits) — see [maps-live-tactical](../../../docs/project-context/docs/maps-live-tactical.md)
- Cross-team visibility + finer admin roles
- Trails / freehand overlays
- Mapbox / Google adapters behind the same port
- Generic friends/selected **shares** (separate product mode — see maps-location-plan)
