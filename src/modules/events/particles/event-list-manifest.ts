import { defineStarforgeModule } from '@/core/modules/define-module'

/** event-list particle — requires product:events. */
export default defineStarforgeModule({
  id: 'event-list',
  kind: 'particle',
  label: 'Event list',
  description:
    'Dense table of published events (list view). Needs product:events. Links to /events/[slug].',
  version: '0.1.0',
  defaultEnabled: true,
  importPath: '@/modules/events/particles/event-list-module',
  exportName: 'eventListModule',
  requires: ['product:events'],
  navViews: [{ key: 'events', label: 'Events', href: '/events' }],
})
