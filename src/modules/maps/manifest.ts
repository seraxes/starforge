import { defineStarforgeModule } from '@/core/modules/define-module'

/**
 * product:maps — map particle + live tactical rooms + MapProvider consumer.
 */
export default defineStarforgeModule({
  id: 'product:maps',
  kind: 'product',
  label: 'Maps',
  description:
    'Map particle (Leaflet + OSM), venue pins, and closed live tactical rooms (roster teams). MapProvider Core port.',
  version: '0.2.0',
  defaultEnabled: true,
  requires: [],
  navViews: [
    { key: 'events', label: 'Events', href: '/events' },
    { key: 'admin', label: 'Live maps', href: '/admin/maps' },
  ],
  admin: {
    navGroup: {
      id: 'maps',
      label: 'Maps',
      href: '/admin/maps',
      expandable: true,
      order: 49,
    },
    nav: [
      {
        group: 'maps',
        label: 'Live maps',
        href: '/admin/maps',
        order: 10,
        area: 'maps',
        exact: true,
      },
    ],
    areas: [{ key: 'maps', label: 'Maps' }],
    routes: [
      {
        path: 'maps',
        pageImportPath: '@/modules/maps/admin/MapsLiveRoomsPage',
        pageExportName: 'default',
      },
      {
        path: 'maps/[roomId]',
        pageImportPath: '@/modules/maps/admin/MapsLiveRoomEditPage',
        pageExportName: 'default',
      },
    ],
  },
  db: { schema: 'src/modules/maps/schema.ts' },
})
