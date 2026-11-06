/**
 * MapProvider factory — Core port for product:maps (+ Events venue pins).
 */

import 'server-only'

import { createLeafletOsmMapProvider } from './leaflet-osm'
import {
  isMapProviderId,
  type MapProvider,
  type MapProviderId,
} from './types'

export type {
  GeoPoint,
  MapClientConfig,
  MapMarker,
  MapProvider,
  MapProviderId,
} from './types'
export { MAP_PROVIDERS, isMapProviderId } from './types'

export type MapProviderFactoryOptions = {
  provider?: string | null
}

export function createMapProvider(options: MapProviderFactoryOptions = {}): MapProvider {
  const id: MapProviderId = isMapProviderId(options.provider)
    ? options.provider
    : 'leaflet-osm'
  switch (id) {
    case 'leaflet-osm':
    default:
      return createLeafletOsmMapProvider()
  }
}

/**
 * Active MapProvider. Provider id from env `STARFORGE_MAP_PROVIDER` (default leaflet-osm).
 * Module settings may override later via caller passing `provider`.
 */
export async function getMapProvider(providerId?: string | null): Promise<MapProvider> {
  const fromEnv = (process.env.STARFORGE_MAP_PROVIDER || '').trim()
  return createMapProvider({ provider: providerId || fromEnv || 'leaflet-osm' })
}
