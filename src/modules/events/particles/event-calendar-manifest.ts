import { defineStarforgeModule } from '@/core/modules/define-module'

/** event-calendar particle — requires product:events. */
export default defineStarforgeModule({
  id: 'event-calendar',
  kind: 'particle',
  label: 'Event calendar',
  description:
    'Month calendar view (title, seats, venue; optional thumbnails). Needs product:events.',
  version: '0.1.0',
  defaultEnabled: true,
  importPath: '@/modules/events/particles/event-calendar-module',
  exportName: 'eventCalendarModule',
  requires: ['product:events'],
  navViews: [{ key: 'events', label: 'Events', href: '/events' }],
  editorImportPath: '@/app/(frontend)/admin/layouts/events-particle-editors',
  editorExportName: 'EventCalendarParticleEditor',
})
