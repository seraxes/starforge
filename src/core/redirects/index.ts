/**
 * Redirects module (SF-130 / product:redirects).
 *
 * i18n P2 policy: store path-relative from/to (no locale prefix). Proxy matches
 * the bare path and re-prefixes destinations with the current request locale.
 * No per-locale redirect trees.
 *
 * Client components: import actions from `@/core/redirects/actions` and types
 * from `@/core/redirects/types` — not this barrel (store is server-only).
 */

export {
  createRedirectAction,
  deleteRedirectAction,
  importRedirectsCsvAction,
  listRedirectsForAdmin,
  toggleRedirectEnabledAction,
  updateRedirectAction,
} from './actions'
export type { RedirectAdminActionState } from './actions'
export {
  parseRedirectCsv,
  parseRedirectCsvEnabled,
  parseRedirectCsvStatus,
  validateRedirectCsvRow,
} from './csv'
export {
  normalizeRedirectFromPath,
  normalizeRedirectToPath,
  resolveLocaleAwareRedirectPath,
  resolveRedirectDestination,
} from './paths'
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
export { REDIRECT_STATUS_CODES, isRedirectStatusCode } from './types'
export type {
  RedirectLookupHit,
  RedirectRecord,
  RedirectStatusCode,
} from './types'
