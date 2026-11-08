import { defineStarforgeModule } from '@/core/modules/define-module'

/** event-mini-calendar particle — requires product:events. */
export default defineStarforgeModule({
  id: 'event-mini-calendar',
  kind: 'particle',
  label: 'Event mini calendar',
  description:
    'Compact month calendar + upcoming list. Place in any layout position. Needs product:events.',
  version: '0.1.0',
  defaultEnabled: true,
  importPath: '@/modules/events/particles/event-mini-calendar-module',
  exportName: 'eventMiniCalendarModule',
  requires: ['product:events'],
  navViews: [{ key: 'events', label: 'Events', href: '/events' }],
  editorImportPath: '@/app/(frontend)/admin/layouts/events-particle-editors',
  editorExportName: 'EventMiniCalendarParticleEditor',
})
