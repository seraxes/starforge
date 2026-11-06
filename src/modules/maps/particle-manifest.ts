import { defineStarforgeModule } from '@/core/modules/define-module'

/** map particle — requires product:maps. */
export default defineStarforgeModule({
  id: 'map',
  kind: 'particle',
  label: 'Map',
  description:
    'Leaflet map with optional Event venue pins. Needs product:maps (+ product:events for pins).',
  version: '0.1.0',
  defaultEnabled: true,
  importPath: '@/modules/maps',
  exportName: 'mapModule',
  requires: ['product:maps'],
  navViews: [{ key: 'events', label: 'Events', href: '/events' }],
})
