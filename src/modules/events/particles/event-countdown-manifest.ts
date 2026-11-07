import { defineStarforgeModule } from '@/core/modules/define-module'

/** event-countdown particle — requires product:events. */
export default defineStarforgeModule({
  id: 'event-countdown',
  kind: 'particle',
  label: 'Event countdown',
  description:
    'Live countdown to a published event start (id or slug in particle config). Needs product:events.',
  version: '0.1.0',
  defaultEnabled: true,
  importPath: '@/modules/events/particles/event-countdown-module',
  exportName: 'eventCountdownModule',
  requires: ['product:events'],
  navViews: [{ key: 'events', label: 'Events', href: '/events' }],
})
