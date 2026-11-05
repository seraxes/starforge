import { defineStarforgeModule } from '@/core/modules/define-module'

/**
 * product:events — Events + venues manager (PR1: schema + admin CRUD).
 * Public particles / registration / Email confirm = later PRs.
 */
export default defineStarforgeModule({
  id: 'product:events',
  kind: 'product',
  label: 'Events',
  description:
    'Events + venues manager — schedule, Media cover, ACL tags, and admin CRUD. Registration and public particles land in later packs.',
  version: '0.1.0',
  defaultEnabled: true,
  requires: ['product:media'],
  i18n: {
    namespaces: ['product:events'],
  },
  navViews: [
    { key: 'admin', label: 'Events', href: '/admin/events' },
    { key: 'venues', label: 'Venues', href: '/admin/events/venues' },
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
