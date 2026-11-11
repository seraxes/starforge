/**
 * product:redirects public door.
 *
 * Server callers that may import this pack (the lookup route, and modules
 * listed in `requires`) use this file. Core and `src/proxy.ts` do not —
 * they run the generated `runProxyHooks` chain.
 *
 * The admin client in this pack imports `./actions` and `./types` so the
 * server store stays off the client graph.
 */
import 'server-only'

export {
  createRedirect,
  deleteRedirect,
  findRedirectByFromPath,
  findRedirectById,
  importRedirectsFromCsv,
  listRedirects,
  lookupEnabledRedirect,
  updateRedirect,
} from './store'
export type {
  CreateRedirectInput,
  ImportRedirectsResult,
  UpdateRedirectInput,
} from './store'
export {
  normalizeRedirectFromPath,
  normalizeRedirectToPath,
  resolveLocaleAwareRedirectPath,
  resolveRedirectDestination,
} from './paths'
export { REDIRECT_STATUS_CODES, isRedirectStatusCode } from './types'
export type {
  RedirectLookupHit,
  RedirectRecord,
  RedirectStatusCode,
} from './types'
