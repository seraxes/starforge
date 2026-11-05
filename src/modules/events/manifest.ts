import { defineStarforgeModule } from '@/core/modules/define-module'

/**
 * product:events — thin stub pack (Dashboard “upcoming” glance).
 * Full Events/venues manager lands later; this row exists so `/admin` can
 * host a soft Coming soon card without a central Stats module.
 */
export default defineStarforgeModule({
  id: 'product:events',
  kind: 'product',
  label: 'Events',
  description:
    'Events + venues manager (upcoming). Soft Dashboard stub until the Events pack ships schema and admin.',
  version: '0.0.1',
  defaultEnabled: true,
  /**
   * Events packs ship `messages/<locale>.json` from day one (i18n P3).
   * No catalog yet — add `src/modules/events/messages/{en,hu}.json` when
   * public/admin UI strings land. See `src/modules/MESSAGES.md`.
   */
  i18n: {
    namespaces: ['product:events'],
  },
  navViews: [{ key: 'admin', label: 'Events (upcoming)', href: '/admin/settings' }],
  admin: {
    areas: [{ key: 'events', label: 'Events' }],
    dashboard: [
      {
        id: 'events.upcoming',
        title: 'Events',
        order: 70,
        size: 'md',
        widgetImportPath: '@/modules/events/dashboard/EventsUpcomingWidget',
        widgetExportName: 'EventsUpcomingWidget',
        statsImportPath: '@/modules/events/dashboard/events-stats',
        statsExportName: 'loadEventsUpcomingStats',
      },
    ],
  },
})
