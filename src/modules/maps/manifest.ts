import { defineStarforgeModule } from '@/core/modules/define-module'

/**
 * product:maps — map particle + MapProvider consumer (venue pins via Events).
 */
export default defineStarforgeModule({
  id: 'product:maps',
  kind: 'product',
  label: 'Maps',
  description:
    'Map particle (Leaflet + OSM). Pins Event venues with coordinates. MapProvider Core port; location-sharing later.',
  version: '0.1.0',
  defaultEnabled: true,
  requires: [],
  navViews: [{ key: 'events', label: 'Events', href: '/events' }],
})
