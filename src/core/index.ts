/**
 * Starforge core public surface.
 * Feature modules (auth, users, jobs, …) should export through here over time.
 */
export { auth } from './auth'
export { contentCacheTags, getPublishedContentCache } from './content/cache'
export type { ContentCacheGetOptions, PublishedContentCache } from './content/cache'
export { absoluteMediaUrl, buildPageMetadata } from './content/metadata'
export { getDraftPageBySlug, getPublishedPageBySlug } from './content/pages'
export { requireDraftPreviewAccess, resolveDraftPreviewAccess } from './content/preview'
export { invalidatePublishedPage, invalidateSiteSettings } from './content/revalidate'
export {
  db,
  pool,
  DEFAULT_LAYOUT_ID,
  sfUsers,
  sfSessions,
  sfAccounts,
  sfVerifications,
  sfLayouts,
} from './db'
export {
  ensureDefaultLayoutSeeded,
  getAssignmentsForPosition,
  getLayoutDocument,
  getRegisteredModule,
  LAYOUT_POSITIONS,
  listRegisteredModules,
  loadLayoutDocument,
  ModuleSlot,
  PublicLayoutBody,
  registerModule,
  saveLayoutDocument,
} from './modules'
export type {
  LayoutAssignment,
  LayoutDocument,
  LayoutModuleAssignment,
  LayoutPosition,
  LayoutPositionId,
  LayoutSection,
  ModuleRenderContext,
  StarforgeModule,
} from './modules'
export {
  ensureSiteSettingsDefaults,
  getFeatureFlags,
  getSiteSettings,
  isDraftPreviewEnabled,
  isModulesEnabled,
  isRegistrationEnabled,
  seedPrimaryNavFromPages,
  updateSiteSettings,
} from './settings'
export {
  BOOTSTRAP_ADMIN_EMAIL,
  ensureCmsAccessForCoreUserIds,
  ensurePayloadCmsUser,
  findPayloadCmsUserByCoreUserId,
  findPayloadCmsUserByEmail,
  loadCoreUserCmsAccess,
  revokePayloadCmsUser,
  setCoreUserCmsAccess,
  userHasCmsAccess,
} from './cms-bridge'
export {
  clearPayloadAdminSession,
  establishPayloadAdminSession,
  PAYLOAD_TOKEN_COOKIE,
  setPayloadAdminSessionCookie,
} from './cms-bridge/payload-session'
