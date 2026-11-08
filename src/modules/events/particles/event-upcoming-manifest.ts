import { defineStarforgeModule } from '@/core/modules/define-module'

/** event-upcoming particle — requires product:events. */
export default defineStarforgeModule({
  id: 'event-upcoming',
  kind: 'particle',
  label: 'Event upcoming',
  description:
    'Upcoming events as cards (title, when, venue, seats, price). Needs product:events.',
  version: '0.1.0',
  defaultEnabled: true,
  importPath: '@/modules/events/particles/event-upcoming-module',
  exportName: 'eventUpcomingModule',
  requires: ['product:events'],
  navViews: [{ key: 'events', label: 'Events', href: '/events' }],
  editorImportPath: '@/app/(frontend)/admin/layouts/events-particle-editors',
  editorExportName: 'EventUpcomingParticleEditor',
})
