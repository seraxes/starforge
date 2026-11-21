import 'server-only'

/**
 * product:events public door for consumers (Social hosted calendars, etc.).
 *
 *   import {
 *     listEventsForHost,
 *     resolveSocialEventHost,
 *     buildHostedEventCreateHref,
 *   } from '@/modules/events/api'
 *
 * Boot / Maps catalog / ICS stay on `@/modules/events/api.server`.
 * The event editor stays `/admin/events` — consumers list and link create here.
 */

export {
  EVENT_HOST_KINDS,
  SOCIAL_EVENTS_HOST_MODULE,
  buildHostedEventCreateHref,
  buildHostedEventEditHref,
  isEventHostKind,
  parseEventHost,
  resolveSocialEventHost,
} from './host'
export type { EventHostKind, EventHostRef } from './host'

export {
  createEvent,
  findEventById,
  listEventsForHost,
} from './store'
export type { EventRecord } from './types'
