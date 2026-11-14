/**
 * Starforge core public surface.
 * Feature modules (auth, users, jobs, …) should export through here over time.
 */
export { auth } from './auth'
export { contentCacheTags, getPublishedContentCache } from './content/cache'
export type { ContentCacheGetOptions, PublishedContentCache } from './content/cache'
export {
  absoluteAssetUrl,
  absoluteMediaUrl,
  appOrigin,
  buildPageMetadata,
} from './content/metadata'
export {
  MEDIA_FOLDERS,
  MEDIA_PURPOSES,
  findMediaById,
  getMediaStorageInfo,
  listMedia,
  preferredMediaUrl,
  resolveMediaBind,
  resolveMediaById,
} from './media'
export type { MediaFolder, MediaPurpose, MediaStorageInfo, ResolvedMedia } from './media'
export type { SiteChromeSeoDefaults } from './content/metadata'
export {
  getDraftPageBySlug,
  getPublishedPageBySlug,
  requireContentLocale,
} from './content/pages'
export { getPageReads, resetPageReadsForTests } from './content/page-reads'
export type {
  PageReadsPort,
  PageReadsPublishedSummary,
  PageReadsSearchDoc,
  PageReadsSearchResult,
} from './content/page-reads'
export {
  SEARCH_QUERY_MAX_LENGTH,
  SEARCH_RESULT_LIMIT,
  normalizeSearchQuery,
  publishedPagePath,
} from './content/search-query'
export { searchPublishedPages } from './content/search'
export type { PublishedSearchHit, PublishedSearchResult } from './content/search'
export { listPublishedPagesForSitemap } from './content/sitemap'
export type { SitemapPageEntry } from './content/sitemap'
export { requireDraftPreviewAccess, resolveDraftPreviewAccess } from './content/preview'
export {
  invalidateLayout,
  invalidateNavMenu,
  invalidatePageChrome,
  invalidatePublishedPage,
  invalidateSiteChrome,
  invalidateSiteSettings,
} from './content/revalidate'
export {
  db,
  pool,
  DEFAULT_LAYOUT_ID,
  DEFAULT_NAV_MENU_ID,
  GLOBAL_PAGE_CHROME_ID,
  SITE_CHROME_ID,
  sfUsers,
  sfSessions,
  sfAccounts,
  sfVerifications,
  sfTwoFactors,
  sfLayouts,
  sfPageChrome,
  sfSiteChrome,
  sfNavMenus,
  sfForms,
  sfFormSubmissions,
  sfUserGroups,
  sfUserGroupMembers,
  sfAclPermissions,
  sfAdminAudit,
} from './db'
export {
  ensureDefaultNavMenuSeeded,
  findNavOverridesForPath,
  listNavMenus,
  loadNavMenu,
  resolveNavMenuItems,
  seedMainNavFromPages,
} from './nav'
export type { NavMenuItem, NavMenuMeta, ResolvedNavItem } from './nav'
export {
  BodyAttributesApplier,
  DocumentBodyChrome,
  DocumentHeadChrome,
  ensureGlobalPageChromeSeeded,
  ensureAtomsRegistered,
  getResolvedPageChrome,
  getResolvedPageChromeForOutline,
  HOME_PAGE_KEY,
  mergePageChrome,
  pageKeyFromPathname,
  resolvePageChrome,
  resolvePageChromeForOutline,
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
  ALLOWLISTED_MODULE_IDS,
  MODULE_ALLOWLIST_FLAVOR,
  MODULE_IDS,
  ensureSiteSettingsDefaults,
  ensureSiteSettingsSchemaHealed,
  getFeatureFlags,
  getSiteSettings,
  isAtomModuleEnabled,
  isCatalogModuleEnabled,
  isDraftPreviewEnabled,
  isModuleAllowlisted,
  isModulesEnabled,
  isParticleModuleEnabled,
  isRegistrationEnabled,
  listInstalledModuleCatalog,
  seedPrimaryNavFromPages,
  updateSiteSettings,
} from './settings'
export type { ModuleCatalogItem, ModuleToggleMap } from './settings'
export {
  getActiveAdminTheme,
  getActiveAdminThemeId,
  listAdminThemes,
} from './admin-theme'
export type { AdminTheme, AdminThemeId, AdminThemeTokens } from './admin-theme'
export {
  CORE_ADMIN_BASE,
  PAYLOAD_ADMIN_BASE,
  PAYLOAD_ADMIN_PREFIX,
  coreAdminPath,
  payloadAdminPath,
  isCoreAdminPath,
  isPayloadAdminPath,
} from './admin-paths'
export {
  buildAdminNavGroups,
  resolveEnabledAdminNavModuleIds,
  CMS_NAV_LINKS,
} from './admin-nav'
export type {
  AdminNavFeatureFlags,
  AdminNavGroup,
  AdminNavLink,
  AdminNavSurface,
} from './admin-nav'
export {
  createMailer,
  getMailer,
  getMailerInfo,
  sendMail,
  withEmailSendLog,
} from './mail'
export type {
  MailEmailType,
  Mailer,
  MailerInfo,
  MailMessage,
  MailProvider,
  MailSendMeta,
  MailSendResult,
} from './mail'
export {
  canSubscribe,
  filterSubscribableChannels,
  filterSubscribableChannelsAsync,
  getRealtimePort,
  parseRealtimeChannels,
  userChannel,
} from './realtime'
export type {
  RealtimeEvent,
  RealtimeInfo,
  RealtimePayload,
  RealtimePort,
} from './realtime'
export {
  getJobRunner,
  registerJobHandler,
} from './jobs'
export type {
  JobEnqueueInput,
  JobEnqueueResult,
  JobHandler,
  JobPayload,
  JobRunner,
  JobRunnerInfo,
} from './jobs'
export {
  applySecurityHeaders,
  buildCspHeaders,
  buildSecurityHeaders,
  clientIp,
  composeCspSources,
  enforceCaptchaFromFormData,
  getCaptchaProvider,
  getRateLimiter,
  mergeCspSources,
  appTrustedOrigins,
  hasUntrustedOrigin,
  payloadCsrfOrigins,
  resolveCaptchaForSurface,
  resolveCspMode,
  resolveFormCaptcha,
  shouldUseSecureCookies,
  trustedProxyHops,
  verifyCaptchaToken,
  verifyTurnstileToken,
} from './security'
export type {
  CaptchaPort,
  CaptchaProviderId,
  CaptchaSurface,
  CspDirective,
  CspMode,
  CspSources,
  RateLimitConsumeOptions,
  RateLimitResult,
  RateLimiter,
  ResolvedCaptcha,
  SecurityHeader,
} from './security'
export {
  CONSENT_COOKIE_NAME,
  CONSENT_EVENT,
  buildConsentPreferences,
  hasAnalyticsConsent,
  parseConsentPreferences,
  readConsentFromCookieHeader,
  readConsentFromDocumentCookie,
  serializeConsentPreferences,
  writeConsentCookie,
} from './consent'
export type { ConsentChangeDetail, ConsentPreferences } from './consent'
export {
  ensureSiteChromeSeeded,
  getSiteChrome,
  saveSiteChrome,
  siteChromeCookieAttributes,
} from './site-chrome'
export type { CaptchaProvider, SiteChromeDocument } from './site-chrome'
export {
  DEFAULT_LOCALIZATION,
  getLocalizationSettings,
  normalizeLocalizationSettings,
  saveLocalizationSettings,
} from './localization'
export type { LocalizationSettings } from './localization'
export {
  BOOTSTRAP_LOCALES,
  DEFAULT_LOCALE,
  DEFAULT_LOCALE_CATALOG,
  LOCALES,
  LOCALE_LABELS,
  isAppLocale,
  isBootstrapLocale,
  isValidLocaleCode,
  labelForLocale,
  normalizeLocaleCode,
  toPayloadLocale,
  routing,
  hasLocalePrefix,
  pathnameWithoutLocale,
  stripLocalePrefix,
  withLocalePrefix,
  buildLanguageAlternates,
  languageAlternateMetadata,
  coerceAppLocale,
  isLocaleAwareNavItemActive,
  navHref,
} from './i18n'
export {
  getEnabledPublicLocales,
  getEnabledPublicLocaleEntries,
  getPublicDefaultLocale,
  getPublicLocaleCatalog,
} from './i18n/enabled'
export type { AppLocale, BootstrapLocale, LocaleCatalogEntry, PathWithoutLocale } from './i18n'
export {
  ENV_EDITOR_FIELDS,
  ENV_EDITOR_GROUPS,
  envEditorIsWritable,
  getEnvEditorWriteMode,
} from './env-editor'
export type { EnvEditorSnapshot, EnvEditorWriteMode } from './env-editor'
export { getEnvOverlayPath, loadEnvEditorSnapshot } from './env-editor/server'
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
export {
  ACL_ADMIN_RESOURCES,
  accessTagsForStorage,
  canSeeNavAccessLevel,
  canSeeNavAccessTags,
  ensureDefaultUserGroupsSeeded,
  filterNavItemsForViewer,
  getAccessViewer,
  getAdminAccessViewer,
  listUserGroupOptions,
  listUserGroups,
  normalizeAccessTags,
  resolveAccessTags,
  toggleAccessTag,
  viewerMayAccessAdminResource,
} from './acl'
export type {
  AccessViewer,
  AclAdminResourceKey,
  UserGroup,
  UserGroupOption,
} from './acl'
