import { defineStarforgeModule } from '@/core/modules/define-module'

/**
 * product:events — Events + venues + registration + ticket tiers.
 */
export default defineStarforgeModule({
  id: 'product:events',
  kind: 'product',
  label: 'Events',
  description:
    'Events + venues — admin CRUD, public list/detail, registration with ticket tiers, event particles.',
  version: '0.4.0',
  defaultEnabled: true,
  requires: ['product:media'],
  i18n: {
    namespaces: ['product:events'],
  },
  navViews: [
    { key: 'public', label: 'Events', href: '/events' },
    { key: 'admin', label: 'Events admin', href: '/admin/events' },
    { key: 'venues', label: 'Venues', href: '/admin/events/venues' },
    { key: 'tiers', label: 'Ticket tiers', href: '/admin/events/tiers' },
    { key: 'registrants', label: 'Registrants', href: '/admin/events/registrants' },
    { key: 'settings', label: 'Events settings', href: '/admin/events/settings' },
  ],
  admin: {
    navGroup: {
      id: 'events',
      label: 'Events',
      href: '/admin/events',
      expandable: true,
      order: 48,
    },
    nav: [
      {
        group: 'events',
        label: 'Events',
        href: '/admin/events',
        order: 10,
        area: 'events',
        exact: true,
      },
      {
        group: 'events',
        label: 'Venues',
        href: '/admin/events/venues',
        order: 20,
        area: 'events',
      },
      {
        group: 'events',
        label: 'Tiers',
        href: '/admin/events/tiers',
        order: 25,
        area: 'events',
      },
      {
        group: 'events',
        label: 'Registrants',
        href: '/admin/events/registrants',
        order: 28,
        area: 'events',
      },
      {
        group: 'events',
        label: 'Settings',
        href: '/admin/events/settings',
        order: 30,
        area: 'events',
      },
    ],
    areas: [{ key: 'events', label: 'Events' }],
    routes: [
      {
        path: 'events',
        pageImportPath: '@/modules/events/admin/EventsListPage',
        pageExportName: 'default',
      },
      {
        path: 'events/venues',
        pageImportPath: '@/modules/events/admin/EventsVenuesPage',
        pageExportName: 'default',
      },
      {
        path: 'events/tiers',
        pageImportPath: '@/modules/events/admin/EventsTiersPage',
        pageExportName: 'default',
      },
      {
        path: 'events/registrants',
        pageImportPath: '@/modules/events/admin/EventsRegistrantsPage',
        pageExportName: 'default',
      },
      {
        path: 'events/settings',
        pageImportPath: '@/modules/events/admin/EventsSettingsPage',
        pageExportName: 'default',
      },
    ],
    dashboard: [
      {
        id: 'events.upcoming',
        title: 'Events',
        order: 70,
        size: 'md',
        area: 'events',
        widgetImportPath: '@/modules/events/dashboard/EventsUpcomingWidget',
        widgetExportName: 'EventsUpcomingWidget',
        statsImportPath: '@/modules/events/dashboard/events-stats',
        statsExportName: 'loadEventsUpcomingStats',
      },
    ],
  },
  db: { schema: 'src/modules/events/schema.ts' },
})
