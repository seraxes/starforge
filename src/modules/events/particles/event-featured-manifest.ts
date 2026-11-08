import { defineStarforgeModule } from '@/core/modules/define-module'

/** event-featured particle — requires product:events. */
export default defineStarforgeModule({
  id: 'event-featured',
  kind: 'particle',
  label: 'Event featured',
  description:
    'Rotating carousel of Featured events. Place in any layout position. Needs product:events.',
  version: '0.1.0',
  defaultEnabled: true,
  importPath: '@/modules/events/particles/event-featured-module',
  exportName: 'eventFeaturedModule',
  requires: ['product:events'],
  navViews: [{ key: 'events', label: 'Events', href: '/events' }],
  editorImportPath: '@/app/(frontend)/admin/layouts/events-particle-editors',
  editorExportName: 'EventFeaturedParticleEditor',
})
