/**
 * Redirects module (SF-130 / product:redirects).
 *
 * Client components: import actions from `@/core/redirects/actions` and types
 * from `@/core/redirects/types` — not this barrel (store is server-only).
 */

export {
  createRedirectAction,
  deleteRedirectAction,
  listRedirectsForAdmin,
  toggleRedirectEnabledAction,
  updateRedirectAction,
} from './actions'
export type { RedirectAdminActionState } from './actions'
export {
  normalizeRedirectFromPath,
  normalizeRedirectToPath,
  resolveRedirectDestination,
} from './paths'
export {
  createRedirect,
  deleteRedirect,
  findRedirectById,
  listRedirects,
  lookupEnabledRedirect,
  updateRedirect,
} from './store'
export { REDIRECT_STATUS_CODES, isRedirectStatusCode } from './types'
export type {
  RedirectLookupHit,
  RedirectRecord,
  RedirectStatusCode,
} from './types'
