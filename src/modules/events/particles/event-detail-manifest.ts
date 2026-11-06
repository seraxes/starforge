import { defineStarforgeModule } from '@/core/modules/define-module'

/** event-detail particle — requires product:events. */
export default defineStarforgeModule({
  id: 'event-detail',
  kind: 'particle',
  label: 'Event detail',
  description:
    'Single published event (id or slug in particle config). Needs product:events.',
  version: '0.1.0',
  defaultEnabled: true,
  importPath: '@/modules/events/particles/event-detail-module',
  exportName: 'eventDetailModule',
  requires: ['product:events'],
  navViews: [{ key: 'events', label: 'Events', href: '/events' }],
})
