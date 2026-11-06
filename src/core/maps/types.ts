/**
 * MapProvider infrastructure port (maps-location-plan).
 * Secrets stay in env; Site Settings / module settings pick provider id.
 */

export type GeoPoint = { lat: number; lng: number }

export type MapMarker = GeoPoint & {
  id?: string
  label?: string
  href?: string
}

export type MapClientConfig = {
  provider: string
  /** Env key name for public token when needed (empty for OSM). */
  publicKeyEnv: string
  defaultStyle?: string
  /** Leaflet / tile template when client draws the map. */
  tileUrl: string
  tileAttribution: string
  defaultZoom: number
}

export type MapProvider = {
  id: string
  /** Geocode address → point (optional). */
  geocode?(query: string): Promise<GeoPoint | null>
  /** Reverse geocode for display labels (optional). */
  reverseGeocode?(point: GeoPoint): Promise<string | null>
  /** Client tile / key hints for map particles. */
  clientConfig(): MapClientConfig
}

export type MapProviderId = 'leaflet-osm'

export const MAP_PROVIDERS: Array<{ value: MapProviderId; label: string }> = [
  { value: 'leaflet-osm', label: 'Leaflet + OpenStreetMap (dev / free tiles)' },
]

export function isMapProviderId(value: unknown): value is MapProviderId {
  return value === 'leaflet-osm'
}
