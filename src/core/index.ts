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
  GLOBAL_PAGE_CHROME_ID,
  sfUsers,
  sfSessions,
  sfAccounts,
  sfVerifications,
  sfLayouts,
  sfPageChrome,
} from './db'
export {
  BodyAttributesApplier,
  DocumentBodyChrome,
  DocumentHeadChrome,
  ensureGlobalPageChromeSeeded,
  ensureAtomsRegistered,
  getResolvedPageChrome,
  HOME_PAGE_KEY,
  mergePageChrome,
  pageKeyFromPathname,
  resolvePageChrome,
} from './page-settings'
export type {
  PageChrome,
  ResolvedPageChrome,
  PageAtomInstance,
  MetaTag,
  AssetRef,
} from './page-settings'
export {
  createLayoutOutline,
  deleteLayoutOutline,
  duplicateLayoutOutline,
  ensureDefaultLayoutSeeded,
  getAssignmentsForPosition,
  getLayoutDocument,
  getLayoutOutline,
  getRegisteredModule,
  isDefaultLayoutOutline,
  LAYOUT_GRID_COLUMNS,
  LAYOUT_POSITIONS,
  listLayoutOutlines,
  listRegisteredModules,
  loadLayoutDocument,
  ModuleSlot,
  PublicLayoutBody,
  registerModule,
  renameLayoutOutline,
  saveLayoutDocument,
  SlotRenderer,
} from './modules'
export type {
  LayoutAssignment,
  LayoutDocument,
  LayoutModuleAssignment,
  LayoutOutlineMeta,
  LayoutPosition,
  LayoutPositionId,
  LayoutRow,
  LayoutSection,
  LayoutSlot,
  LayoutSlotConfig,
  ModuleRenderContext,
  StarforgeModule,
} from './modules'
export {
  MODULE_IDS,
  ensureSiteSettingsDefaults,
  getFeatureFlags,
  getSiteSettings,
  isAtomModuleEnabled,
  isCatalogModuleEnabled,
  isDraftPreviewEnabled,
  isModulesEnabled,
  isParticleModuleEnabled,
  isRegistrationEnabled,
  listInstalledModuleCatalog,
  seedPrimaryNavFromPages,
  updateSiteSettings,
} from './settings'
export type { ModuleCatalogItem, ModuleToggleMap } from './settings'
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
