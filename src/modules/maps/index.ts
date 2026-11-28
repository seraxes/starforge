import React from 'react'
import { getTranslations } from 'next-intl/server'

import { getMapProvider } from '@/core/maps'
import type { MapMarker } from '@/core/maps/types'
import type { StarforgeModule } from '@/core/modules/types'
import { MODULE_IDS, isCatalogModuleEnabled } from '@/core/settings'

import { MapView } from './MapView'
import { readMapConfig } from './config'

/**
 * map particle — venue pins from product:events when enabled.
 */
export const mapModule: StarforgeModule = {
  id: 'map',
  name: 'Map',
  description: 'Leaflet map with optional Event venue pins (product:maps).',
  defaultWidth: 100,
  navViews: [{ key: 'events', label: 'Events', href: '/events' }],
  render: async ({ slot, settings }) => {
    if (!isCatalogModuleEnabled(settings, MODULE_IDS.maps)) {
      return null
    }

    const cfg = readMapConfig(slot.config)
    const provider = await getMapProvider()
    const clientConfig = provider.clientConfig()
    const markers: MapMarker[] = []

    if (cfg.showEventVenues && isCatalogModuleEnabled(settings, MODULE_IDS.events)) {
      try {
        const { listEventCatalog } = await import('./api.server')
        markers.push(...(await listEventCatalog().listPublishedVenues()))
      } catch {
        // Catalog missing or venue lookup failed — render empty map if center set.
      }
    }

    const center =
      cfg.centerLat != null && cfg.centerLng != null
        ? { lat: cfg.centerLat, lng: cfg.centerLng }
        : undefined

    if (!markers.length && !center) {
      const t = await getTranslations('product:maps')
      return React.createElement(
        'p',
        { className: 'sf-map-empty settings-hint' },
        t('emptyNoPins'),
      )
    }

    return React.createElement(
      'div',
      { className: 'sf-map-particle' },
      cfg.heading.trim()
        ? React.createElement('h2', { className: 'sf-map-particle-heading' }, cfg.heading.trim())
        : null,
      React.createElement(MapView, {
        markers,
        clientConfig,
        center,
        zoom: cfg.zoom,
        height: cfg.height,
      }),
    )
  },
}

export { MapView, type MapViewProps } from './MapView'
export {
  VenueLocationMap,
  type VenueLocationMapProps,
} from './VenueLocationMap'
export { defaultMapConfig, readMapConfig, type MapParticleConfig } from './config'
export { liveMapModule } from './live-map-module'
export { EventLiveMap } from './public/EventLiveMap'
export { LiveMapPanel } from './public/LiveMapPanel'
