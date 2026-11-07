import { defineStarforgeModule } from '@/core/modules/define-module'

/** live-map particle — closed tactical session map. */
export default defineStarforgeModule({
  id: 'live-map',
  kind: 'particle',
  label: 'Live map',
  description:
    'Closed event tactical map (roster teams). Needs product:maps. Join shares GPS with same team only.',
  version: '0.1.0',
  defaultEnabled: true,
  importPath: '@/modules/maps/live-map-module',
  exportName: 'liveMapModule',
  requires: ['product:maps'],
  navViews: [{ key: 'admin', label: 'Live maps admin', href: '/admin/maps' }],
})
