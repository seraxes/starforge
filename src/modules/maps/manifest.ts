import { defineStarforgeModule } from '@/core/modules/define-module'

/**
 * product:maps — TacMap (Tactical Maps): venue pins + closed live rooms + MapProvider.
 */
export default defineStarforgeModule({
  id: 'product:maps',
  kind: 'product',
  layer: 'base',
  label: 'TacMap',
  description:
    'Tactical Maps (TacMap) — venue pins, closed live rooms (roster teams), MapProvider. Leaflet + OSM first.',
  version: '0.2.1',
  defaultEnabled: true,
  i18n: {
    namespaces: ['product:maps'],
  },
  requires: ['product:media'],
  navViews: [
    { key: 'events', label: 'Events', href: '/events' },
    { key: 'admin', label: 'TacMap', href: '/admin/maps' },
  ],
  admin: {
    navGroup: {
      id: 'maps',
      label: 'TacMap',
      href: '/admin/maps',
      expandable: true,
      order: 49,
    },
    nav: [
      {
        group: 'maps',
        label: 'Rooms',
        href: '/admin/maps',
        order: 10,
        area: 'maps',
        exact: true,
      },
    ],
    areas: [{ key: 'maps', label: 'TacMap' }],
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
  apiRoutes: [
    {
      path: 'maps/live/[roomId]/join',
      routeImportPath: '@/modules/maps/routes/join-route',
      handlers: ['POST'],
      dynamic: 'force-dynamic',
    },
    {
      path: 'maps/live/[roomId]/leave',
      routeImportPath: '@/modules/maps/routes/leave-route',
      handlers: ['POST'],
      dynamic: 'force-dynamic',
    },
    {
      path: 'maps/live/[roomId]/positions',
      routeImportPath: '@/modules/maps/routes/positions-route',
      handlers: ['GET'],
      dynamic: 'force-dynamic',
    },
    {
      path: 'maps/live/[roomId]/ingest',
      routeImportPath: '@/modules/maps/routes/ingest-route',
      handlers: ['POST'],
      dynamic: 'force-dynamic',
    },
  ],
  realtimeChannelAcl: {
    importPath: '@/modules/maps/api.server',
    exportName: 'canSubscribeMapChannel',
  },
  db: { schema: 'src/modules/maps/schema.ts' },
})
