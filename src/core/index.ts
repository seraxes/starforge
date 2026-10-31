/**
 * Starforge core public surface.
 * Feature modules (auth, users, jobs, …) should export through here over time.
 */
export { auth } from './auth'
export { absoluteMediaUrl, buildPageMetadata } from './content/metadata'
export { getPublishedPageBySlug } from './content/pages'
export { db, pool, sfUsers, sfSessions, sfAccounts, sfVerifications } from './db'
export {
  ensureSiteSettingsDefaults,
  getFeatureFlags,
  getSiteSettings,
  isRegistrationEnabled,
  updateSiteSettings,
} from './settings'

