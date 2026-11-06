# product:maps

Map particle + Core `MapProvider` (leaflet-osm first).

## v1

- Core port: `src/core/maps` (`getMapProvider`, Nominatim geocode)
- Particle `map` — pins venues that have lat/lng on published upcoming events
- Events venues: optional `latitude` / `longitude` (+ geocode from address in admin)

## Later

- User location shares / friends scope (needs Social)
- Mapbox / Google adapters behind the same port
