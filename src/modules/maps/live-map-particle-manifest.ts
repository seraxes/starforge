import { defineStarforgeModule } from '@/core/modules/define-module'

/** live-map particle — TacMap session map. */
export default defineStarforgeModule({
  id: 'live-map',
  kind: 'particle',
  label: 'TacMap',
  description:
    'Tactical Maps live session (roster teams). Needs product:maps. Join shares GPS with same team only.',
  version: '0.1.1',
  defaultEnabled: true,
  importPath: '@/modules/maps/live-map-module',
  exportName: 'liveMapModule',
  requires: ['product:maps'],
  navViews: [{ key: 'admin', label: 'TacMap admin', href: '/admin/maps' }],
})
