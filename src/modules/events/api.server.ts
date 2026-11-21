/**
 * product:events server door (boot / Maps / ICS / form hooks).
 *
 * Consumer list/create hosting (Social calendars) uses `@/modules/events/api`.
 *
 * `bootEvents` calls `ensureEventsMapCatalog` so Maps can ask for pins, labels,
 * and a roster without importing this pack.
 *
 * Boot also calls `ensureEventsFormHooks` so Form particles on CMS pages still
 * run the event-registration preset, and `ensureEventRegistrationFormSeeded`
 * so the protected definition exists before Forms admin opens (Forms never imports Events).
 *
 *   import { ensureEventsMapCatalog, ensureEventsFormHooks } from '@/modules/events/api.server'
 *
 * Calendar download (`/api/events/:id/ics`) uses the same door. The App Router
 * file is a generated shim; the handler lives in `routes/ics-route.ts`.
 */

import 'server-only'

export { ensureEventsMapCatalog } from './map-catalog'
export { ensureEventsFormHooks } from './form-hooks'
export { ensureEventRegistrationFormSeeded } from './registration-form'
export {
  findEventById,
  findPublishedEventByPublicKey,
  findVenueById,
} from './store'
export { buildEventIcs } from './public/ics'
export {
  viewerPassesEventPassword,
  viewerPassesEventVisibility,
} from './public-access'
