import { cache } from 'react'

import { invalidateSiteSettings } from '@/core/content/revalidate'
import {
  contentCacheTags,
  getPublishedContentCache,
  setPublishedCacheRuntimeConfig,
} from '@/core/content/cache'
import { setRealtimeRuntimeConfig } from '@/core/realtime/runtime-config'
import { isModuleAllowlisted } from '@/generated/module-registry'

import { resolveNavMenuItems } from '@/core/nav/resolve'
import { normalizeSiteRootPointer } from '@/core/nav/root-target'
import { DEFAULT_NAV_MENU_ID } from '@/core/db'

import {
  DEFAULT_ADMIN_AUTOSAVE_DEBOUNCE_MS,
  DEFAULT_FEATURE_FLAGS,
  DEFAULT_FORM_RATE_LIMIT_MAX,
  DEFAULT_FORM_RATE_LIMIT_WINDOW_SEC,
  DEFAULT_DASHBOARD_ONLINE_WINDOW_MIN,
  DEFAULT_DASHBOARD_REFRESH_INTERVAL_SEC,
  DEFAULT_NULL_MISS_TTL_SEC,
  DEFAULT_PRIMARY_NAV,
  DEFAULT_PRIMARY_NAV_MENU_ID,
  DEFAULT_PUBLISHED_CACHE_ENABLED,
  DEFAULT_PUBLISHED_CACHE_TTL_SEC,
  DEFAULT_REALTIME_ENABLED,
  DEFAULT_SITE_NAME,
  DEFAULT_SITE_SETTINGS,
  clampAdminAutosaveDebounceMs,
  clampDashboardOnlineWindowMin,
  clampDashboardRefreshIntervalSec,
  clampFormRateLimitMax,
  clampFormRateLimitWindowSec,
  clampNullMissTtlSec,
  clampPublishedCacheTtlSec,
  coercePublishedCacheEnabled,
  coerceRealtimeEnabled,
  type FeatureFlags,
  type ModuleToggleMap,
  type NavItem,
  type NavItemInput,
  type SiteSettingsData,
} from './defaults'
import {
  MODULE_IDS,
  REQUIRED_MODULE_IDS,
  atomToggleId,
  isModuleToggleEnabled,
  moduleTogglesToPayloadRows,
  normalizeModuleToggles,
} from './module-toggles'
import {
  navHasPageLinks,
  resolveNavItems,
  type RawNavRow,
} from './nav'
import {
  readSiteSettingsRow,
  writeSiteRootItem,
  writeSiteSettingsRow,
  type SiteSettingsRow,
} from './store'

export type { FeatureFlags, ModuleToggleMap, NavItem, NavItemInput, SiteSettingsData }
export type { RawNavRow }
export {
  ensureSiteSettingsSchemaHealed,
  healSiteSettingsSchema,
} from './heal-site-settings-schema'
export type { SiteSettingsSchemaHealResult } from './heal-site-settings-schema'
export {
  ADMIN_AUTOSAVE_DEBOUNCE_MAX_MS,
  ADMIN_AUTOSAVE_DEBOUNCE_MIN_MS,
  DEFAULT_ADMIN_AUTOSAVE_DEBOUNCE_MS,
  DEFAULT_FEATURE_FLAGS,
  DEFAULT_FORM_RATE_LIMIT_MAX,
  DEFAULT_FORM_RATE_LIMIT_WINDOW_SEC,
  DEFAULT_NULL_MISS_TTL_SEC,
  DEFAULT_PRIMARY_NAV,
  DEFAULT_PRIMARY_NAV_MENU_ID,
  DEFAULT_PUBLISHED_CACHE_ENABLED,
  DEFAULT_PUBLISHED_CACHE_TTL_SEC,
  DEFAULT_REALTIME_ENABLED,
  DEFAULT_SITE_NAME,
  DEFAULT_SITE_SETTINGS,
  FORM_RATE_LIMIT_MAX_MAX,
  FORM_RATE_LIMIT_MAX_MIN,
  FORM_RATE_LIMIT_WINDOW_SEC_MAX,
  FORM_RATE_LIMIT_WINDOW_SEC_MIN,
  NULL_MISS_TTL_SEC_MAX,
  NULL_MISS_TTL_SEC_MIN,
  PUBLISHED_CACHE_TTL_SEC_MAX,
  PUBLISHED_CACHE_TTL_SEC_MIN,
  clampAdminAutosaveDebounceMs,
  clampDashboardOnlineWindowMin,
  clampDashboardRefreshIntervalSec,
  clampFormRateLimitMax,
  clampFormRateLimitWindowSec,
  clampNullMissTtlSec,
  clampPublishedCacheTtlSec,
  coercePublishedCacheEnabled,
  coerceRealtimeEnabled,
  DEFAULT_DASHBOARD_ONLINE_WINDOW_MIN,
  DEFAULT_DASHBOARD_REFRESH_INTERVAL_SEC,
  DASHBOARD_ONLINE_WINDOW_MIN_MAX,
  DASHBOARD_ONLINE_WINDOW_MIN_MIN,
  DASHBOARD_REFRESH_INTERVAL_SEC_MAX,
  DASHBOARD_REFRESH_INTERVAL_SEC_MIN,
} from './defaults'
export {
  ATOM_TOGGLE_PREFIX,
  MODULE_IDS,
  MODULE_KIND_ORDER,
  REQUIRED_MODULE_IDS,
  anyExtensionModuleEnabled,
  atomToggleId,
  isModuleToggleEnabled,
  moduleTogglesToPayloadRows,
  normalizeModuleToggles,
  parseAtomToggleId,
} from './module-toggles'
export type { ModuleCatalogItem, ModuleToggleEntry, ModuleToggleKind } from './module-toggles'
import {
  mergeMissingCatalogModuleDefaults,
  repairCatalogModuleDefaultsOnce,
} from './module-catalog'
export {
  PRODUCT_MODULE_CATALOG,
  featureFlagsFromModuleToggles,
  isCatalogModuleEnabled,
  listInstalledModuleCatalog,
  mergeMissingCatalogModuleDefaults,
  repairCatalogModuleDefaultsOnce,
  CATALOG_DEFAULTS_REPAIR_MARKER,
} from './module-catalog'
export {
  findExistingModuleSettingsHref,
  isCoreModuleInfoSettingsHref,
  moduleIdFromPathSegment,
  moduleIdPathSegment,
  moduleInfoSettingsHref,
  resolveModuleInfoSettingsHref,
} from './module-info-settings'
export {
  ALLOWLISTED_MODULE_IDS,
  MODULE_ALLOWLIST_FLAVOR,
  isModuleAllowlisted,
} from '@/generated/module-registry'
export {
  isExternalHref,
  isNavItemActive,
  navHasPageLinks,
  navItemsToCustomInputs,
  normalizeHref,
  pageNavInputs,
  resolveNavItems,
} from './nav'

type SiteSettingsDoc = {
  siteName?: string | null
  primaryNavMenuId?: string | null
  rootItem?: { menuId?: string | null; itemId?: string | null } | null
  adminAutosaveDebounceMs?: number | null
  formRateLimitMax?: number | null
  formRateLimitWindowSec?: number | null
  publishedCacheEnabled?: boolean | null
  publishedCacheTtlSec?: number | null
  nullMissTtlSec?: number | null
  dashboardRefreshIntervalSec?: number | null
  dashboardOnlineWindowMin?: number | null
  realtimeEnabled?: boolean | null
  primaryNav?: RawNavRow[] | null
  featureRegistration?: boolean | null
  featureRichEditor?: boolean | null
  featurePosts?: boolean | null
  featureModules?: boolean | null
  featureDraftPreview?: boolean | null
  moduleToggles?: Array<{ moduleId?: string | null; enabled?: boolean | null }> | null
}

function asToggleRows(raw: unknown): SiteSettingsDoc['moduleToggles'] {
  if (Array.isArray(raw)) return raw as SiteSettingsDoc['moduleToggles']
  if (raw && typeof raw === 'object') {
    return Object.entries(raw as Record<string, unknown>).map(([moduleId, enabled]) => ({
      moduleId,
      enabled: enabled !== false && enabled !== 'false' && enabled !== 0,
    }))
  }
  return []
}

function asNavRows(raw: unknown): RawNavRow[] {
  return Array.isArray(raw) ? (raw as RawNavRow[]) : []
}

function rowToDoc(row: SiteSettingsRow): SiteSettingsDoc {
  return {
    siteName: row.siteName,
    primaryNavMenuId: row.primaryNavMenuId,
    rootItem: row.rootItem,
    adminAutosaveDebounceMs: row.adminAutosaveDebounceMs,
    formRateLimitMax: row.formRateLimitMax,
    formRateLimitWindowSec: row.formRateLimitWindowSec,
    publishedCacheEnabled: row.publishedCacheEnabled,
    publishedCacheTtlSec: row.publishedCacheTtlSec,
    nullMissTtlSec: row.nullMissTtlSec,
    dashboardRefreshIntervalSec: row.dashboardRefreshIntervalSec,
    dashboardOnlineWindowMin: row.dashboardOnlineWindowMin,
    realtimeEnabled: row.realtimeEnabled,
    primaryNav: asNavRows(row.legacyPrimaryNav),
    featureRegistration: row.featureRegistration,
    featureRichEditor: row.featureRichEditor,
    featurePosts: row.featurePosts,
    featureModules: row.featureModules,
    featureDraftPreview: row.featureDraftPreview,
    moduleToggles: asToggleRows(row.moduleToggles),
  }
}

/** Push Performance cache knobs into the sync snapshot used by cache adapters. */
function syncPublishedCacheRuntime(settings: SiteSettingsData): void {
  setPublishedCacheRuntimeConfig({
    enabled: settings.publishedCacheEnabled,
    ttlSec: settings.publishedCacheTtlSec,
    nullMissTtlSec: settings.nullMissTtlSec,
  })
}

/** Push RealtimePort enable into the sync snapshot used by publish / SSE. */
function syncRealtimeRuntime(settings: SiteSettingsData): void {
  setRealtimeRuntimeConfig({ enabled: settings.realtimeEnabled })
}

function normalizePrimaryNavMenuId(raw: string | null | undefined): string {
  const id = typeof raw === 'string' ? raw.trim() : ''
  return id || DEFAULT_PRIMARY_NAV_MENU_ID
}

function normalizeFlags(doc: SiteSettingsDoc | null | undefined): FeatureFlags {
  if (!doc) return { ...DEFAULT_FEATURE_FLAGS }
  return {
    registration: doc.featureRegistration ?? DEFAULT_FEATURE_FLAGS.registration,
    richEditor: doc.featureRichEditor ?? DEFAULT_FEATURE_FLAGS.richEditor,
    posts: doc.featurePosts ?? DEFAULT_FEATURE_FLAGS.posts,
    modules: doc.featureModules ?? DEFAULT_FEATURE_FLAGS.modules,
    draftPreview: doc.featureDraftPreview ?? DEFAULT_FEATURE_FLAGS.draftPreview,
  }
}

function fallbackSettings(): SiteSettingsData {
  const defaults: SiteSettingsData = {
    ...DEFAULT_SITE_SETTINGS,
    features: { ...DEFAULT_FEATURE_FLAGS },
    primaryNav: DEFAULT_PRIMARY_NAV.map((item) => ({ ...item })),
    primaryNavMenuId: DEFAULT_PRIMARY_NAV_MENU_ID,
    rootItem: null,
    moduleToggles: {},
  }
  syncPublishedCacheRuntime(defaults)
  syncRealtimeRuntime(defaults)
  return defaults
}

export function normalizeSiteSettings(
  doc: SiteSettingsDoc | null | undefined,
  resolvedNav?: NavItem[],
): SiteSettingsData {
  if (!doc) {
    const defaults: SiteSettingsData = {
      ...DEFAULT_SITE_SETTINGS,
      features: { ...DEFAULT_FEATURE_FLAGS },
      primaryNav: (resolvedNav ?? DEFAULT_PRIMARY_NAV).map((i) => ({ ...i })),
      primaryNavMenuId: DEFAULT_PRIMARY_NAV_MENU_ID,
      rootItem: null,
      adminAutosaveDebounceMs: DEFAULT_ADMIN_AUTOSAVE_DEBOUNCE_MS,
      formRateLimitMax: DEFAULT_FORM_RATE_LIMIT_MAX,
      formRateLimitWindowSec: DEFAULT_FORM_RATE_LIMIT_WINDOW_SEC,
      publishedCacheEnabled: DEFAULT_PUBLISHED_CACHE_ENABLED,
      publishedCacheTtlSec: DEFAULT_PUBLISHED_CACHE_TTL_SEC,
      nullMissTtlSec: DEFAULT_NULL_MISS_TTL_SEC,
      dashboardRefreshIntervalSec: DEFAULT_DASHBOARD_REFRESH_INTERVAL_SEC,
      dashboardOnlineWindowMin: DEFAULT_DASHBOARD_ONLINE_WINDOW_MIN,
      realtimeEnabled: DEFAULT_REALTIME_ENABLED,
      moduleToggles: {},
    }
    syncPublishedCacheRuntime(defaults)
    syncRealtimeRuntime(defaults)
    return defaults
  }

  const siteName =
    typeof doc.siteName === 'string' && doc.siteName.trim()
      ? doc.siteName.trim()
      : DEFAULT_SITE_NAME

  const normalized: SiteSettingsData = {
    siteName,
    primaryNavMenuId: normalizePrimaryNavMenuId(doc.primaryNavMenuId),
    rootItem: normalizeSiteRootPointer(doc.rootItem),
    adminAutosaveDebounceMs: clampAdminAutosaveDebounceMs(doc.adminAutosaveDebounceMs),
    formRateLimitMax: clampFormRateLimitMax(doc.formRateLimitMax),
    formRateLimitWindowSec: clampFormRateLimitWindowSec(doc.formRateLimitWindowSec),
    publishedCacheEnabled: coercePublishedCacheEnabled(doc.publishedCacheEnabled),
    publishedCacheTtlSec: clampPublishedCacheTtlSec(doc.publishedCacheTtlSec),
    nullMissTtlSec: clampNullMissTtlSec(doc.nullMissTtlSec),
    dashboardRefreshIntervalSec: clampDashboardRefreshIntervalSec(
      doc.dashboardRefreshIntervalSec,
    ),
    dashboardOnlineWindowMin: clampDashboardOnlineWindowMin(doc.dashboardOnlineWindowMin),
    realtimeEnabled: coerceRealtimeEnabled(doc.realtimeEnabled),
    primaryNav: resolvedNav ?? resolveNavItems(doc.primaryNav),
    features: normalizeFlags(doc),
    moduleToggles: normalizeModuleToggles(doc.moduleToggles),
  }
  syncPublishedCacheRuntime(normalized)
  syncRealtimeRuntime(normalized)
  return normalized
}

/**
 * Prefer Nav manager menu set; fall back to legacy primaryNav rows copied once
 * from Payload. Passes a settings snapshot (without resolved nav) so module
 * link types can honor Modules on/off without re-entering getSiteSettings.
 */
async function resolvePrimaryNavForDoc(doc: SiteSettingsDoc): Promise<NavItem[]> {
  const menuId = normalizePrimaryNavMenuId(doc.primaryNavMenuId)
  const settingsForModules = normalizeSiteSettings(doc, [])
  try {
    const fromMenu = await resolveNavMenuItems(menuId, settingsForModules)
    if (fromMenu.length > 0) {
      const legacy = resolveNavItems(doc.primaryNav)
      const menuLooksLikeDefaults =
        fromMenu.length === DEFAULT_PRIMARY_NAV.length &&
        fromMenu.every(
          (item, i) =>
            item.href === DEFAULT_PRIMARY_NAV[i]?.href &&
            item.label === DEFAULT_PRIMARY_NAV[i]?.label,
        )
      if (menuLooksLikeDefaults && navHasPageLinks(doc.primaryNav)) {
        return legacy
      }
      return fromMenu
    }
  } catch {
    // sf_nav_menus missing — use legacy
  }
  return resolveNavItems(doc.primaryNav)
}

async function loadSiteSettingsUncached(): Promise<SiteSettingsData> {
  try {
    const row = await readSiteSettingsRow()
    if (!row) {
      try {
        const fallback = {
          ...DEFAULT_SITE_SETTINGS,
          features: { ...DEFAULT_FEATURE_FLAGS },
          primaryNav: [] as NavItem[],
          primaryNavMenuId: DEFAULT_PRIMARY_NAV_MENU_ID,
          moduleToggles: {},
        }
        const fromMenu = await resolveNavMenuItems(DEFAULT_NAV_MENU_ID, fallback)
        const resolved = { ...fallback, primaryNav: fromMenu }
        syncPublishedCacheRuntime(resolved)
        syncRealtimeRuntime(resolved)
        return resolved
      } catch {
        return fallbackSettings()
      }
    }

    const doc = rowToDoc(row)
    const primaryNav = await resolvePrimaryNavForDoc(doc)
    return normalizeSiteSettings(doc, primaryNav)
  } catch {
    return fallbackSettings()
  }
}

/**
 * Load site settings (`sf_site_settings`) for public chrome / flags.
 * Cross-request cache via published-content cache (Next tags; Redis later);
 * per-request dedupe via React `cache`.
 * Falls back to defaults when the Core row is unavailable.
 */
export const getSiteSettings = cache(async (): Promise<SiteSettingsData> => {
  return getPublishedContentCache().getCached(
    {
      key: ['sf', 'site-settings'],
      tags: [contentCacheTags.siteSettings],
      revalidate: false,
    },
    loadSiteSettingsUncached,
  )
})

/**
 * Uncached site settings for offline / 503 paint.
 * Avoids `unstable_cache` + `revalidateTag({ expire: 0 })` stalls on the lock path.
 */
export async function getSiteSettingsLive(): Promise<SiteSettingsData> {
  return loadSiteSettingsUncached()
}

export async function getFeatureFlags(): Promise<FeatureFlags> {
  const settings = await getSiteSettings()
  return settings.features
}

export async function isRegistrationEnabled(): Promise<boolean> {
  const flags = await getFeatureFlags()
  return flags.registration
}

export async function isDraftPreviewEnabled(): Promise<boolean> {
  const flags = await getFeatureFlags()
  return flags.draftPreview
}

export async function isModulesEnabled(): Promise<boolean> {
  const flags = await getFeatureFlags()
  return flags.modules
}

export type UpdateSiteSettingsInput = {
  siteName: string
  /** Which Nav manager menu powers the public primary nav. */
  primaryNavMenuId?: string
  /** Core admin text autosave debounce (ms); clamped on write. */
  adminAutosaveDebounceMs?: number
  /** Form submit rate-limit max; clamped on write. Site Settings → Performance. */
  formRateLimitMax?: number
  /** Form submit rate-limit window (seconds); clamped on write. */
  formRateLimitWindowSec?: number
  /** Published-content cache on/off; Site Settings → Performance. */
  publishedCacheEnabled?: boolean
  /** Published-content TTL seconds (`0` = tag invalidate only). */
  publishedCacheTtlSec?: number
  /** Redis null-miss TTL seconds. */
  nullMissTtlSec?: number
  /** Dashboard soft-refresh interval (seconds). */
  dashboardRefreshIntervalSec?: number
  /** Online-now session window (minutes). */
  dashboardOnlineWindowMin?: number
  /** RealtimePort SSE / publish on/off; Site Settings → Performance. */
  realtimeEnabled?: boolean
  /**
   * Accepted for callers. Legacy primary nav is not written.
   * The copied Payload array stays a read fallback.
   */
  primaryNav?: NavItem[]
  /** Accepted for callers. Legacy primary nav is not written. */
  primaryNavInputs?: NavItemInput[]
  /** Accepted for callers. Legacy primary nav is never rewritten. */
  keepLegacyPrimaryNav?: boolean
  features: FeatureFlags
  /** Per-module / atom runtime toggles (P0). */
  moduleToggles?: ModuleToggleMap
}

/**
 * Upsert Core `sf_site_settings` (core admin + seed + Site Chrome siteName sync).
 * Invalidates the site-settings cache tag after a successful write.
 */
export async function updateSiteSettings(input: UpdateSiteSettingsInput): Promise<SiteSettingsData> {
  const existing = await readSiteSettingsRow()
  const existingDoc = existing ? rowToDoc(existing) : null
  const siteName = input.siteName.trim() || DEFAULT_SITE_NAME
  const primaryNavMenuId = normalizePrimaryNavMenuId(
    input.primaryNavMenuId ?? existingDoc?.primaryNavMenuId ?? DEFAULT_PRIMARY_NAV_MENU_ID,
  )
  const moduleToggles =
    input.moduleToggles ??
    (existingDoc ? normalizeModuleToggles(existingDoc.moduleToggles) : {})

  const row = await writeSiteSettingsRow({
    siteName,
    primaryNavMenuId,
    adminAutosaveDebounceMs:
      input.adminAutosaveDebounceMs !== undefined
        ? clampAdminAutosaveDebounceMs(input.adminAutosaveDebounceMs)
        : clampAdminAutosaveDebounceMs(existingDoc?.adminAutosaveDebounceMs),
    formRateLimitMax:
      input.formRateLimitMax !== undefined
        ? clampFormRateLimitMax(input.formRateLimitMax)
        : clampFormRateLimitMax(existingDoc?.formRateLimitMax),
    formRateLimitWindowSec:
      input.formRateLimitWindowSec !== undefined
        ? clampFormRateLimitWindowSec(input.formRateLimitWindowSec)
        : clampFormRateLimitWindowSec(existingDoc?.formRateLimitWindowSec),
    publishedCacheEnabled:
      input.publishedCacheEnabled !== undefined
        ? coercePublishedCacheEnabled(input.publishedCacheEnabled)
        : coercePublishedCacheEnabled(existingDoc?.publishedCacheEnabled),
    publishedCacheTtlSec:
      input.publishedCacheTtlSec !== undefined
        ? clampPublishedCacheTtlSec(input.publishedCacheTtlSec)
        : clampPublishedCacheTtlSec(existingDoc?.publishedCacheTtlSec),
    nullMissTtlSec:
      input.nullMissTtlSec !== undefined
        ? clampNullMissTtlSec(input.nullMissTtlSec)
        : clampNullMissTtlSec(existingDoc?.nullMissTtlSec),
    dashboardRefreshIntervalSec:
      input.dashboardRefreshIntervalSec !== undefined
        ? clampDashboardRefreshIntervalSec(input.dashboardRefreshIntervalSec)
        : clampDashboardRefreshIntervalSec(existingDoc?.dashboardRefreshIntervalSec),
    dashboardOnlineWindowMin:
      input.dashboardOnlineWindowMin !== undefined
        ? clampDashboardOnlineWindowMin(input.dashboardOnlineWindowMin)
        : clampDashboardOnlineWindowMin(existingDoc?.dashboardOnlineWindowMin),
    realtimeEnabled:
      input.realtimeEnabled !== undefined
        ? coerceRealtimeEnabled(input.realtimeEnabled)
        : coerceRealtimeEnabled(existingDoc?.realtimeEnabled),
    featureRegistration: input.features.registration,
    featureRichEditor: input.features.richEditor,
    featurePosts: input.features.posts,
    featureModules: input.features.modules,
    featureDraftPreview: input.features.draftPreview,
    moduleToggles: moduleTogglesToPayloadRows(moduleToggles),
  })

  const doc = rowToDoc(row)
  const primaryNav = await resolvePrimaryNavForDoc(doc)
  const normalized = normalizeSiteSettings(doc, primaryNav)
  await invalidateSiteSettings()
  return normalized
}

/** Navigation is the only writer. Null clears the root. */
export async function setSiteRootItem(
  pointer: { menuId: string; itemId: string } | null,
): Promise<void> {
  const next = pointer
    ? normalizeSiteRootPointer(pointer)
    : null
  if (pointer && !next) {
    throw new Error('Site root needs a menu id and an item id.')
  }
  await writeSiteRootItem(next)
  await invalidateSiteSettings()
}

/** Ensure the Core row exists with sensible defaults (idempotent). */
export async function ensureSiteSettingsDefaults(): Promise<SiteSettingsData> {
  try {
    const existing = await readSiteSettingsRow()
    const doc = existing ? rowToDoc(existing) : null

    if (doc?.primaryNav && doc.primaryNav.length > 0) {
      try {
        const { migrateLegacyPrimaryNavToMain } = await import('@/core/nav/store')
        await migrateLegacyPrimaryNavToMain(doc.primaryNav)
      } catch {
        // Table may not exist yet (before db:migrate).
      }
    }

    const hasName = typeof doc?.siteName === 'string' && doc.siteName.trim()
    const hasMenuId =
      typeof doc?.primaryNavMenuId === 'string' && doc.primaryNavMenuId.trim()
    const existingToggles = normalizeModuleToggles(doc?.moduleToggles)
    const missing = mergeMissingCatalogModuleDefaults(existingToggles)
    const repaired = repairCatalogModuleDefaultsOnce(missing.toggles)
    const mergedToggles = repaired.toggles
    const togglesChanged = missing.changed || repaired.changed

    if (existing && hasName && hasMenuId && !togglesChanged) {
      const primaryNav = await resolvePrimaryNavForDoc(doc!)
      return normalizeSiteSettings(doc, primaryNav)
    }

    return updateSiteSettings({
      siteName: hasName ? String(doc?.siteName).trim() : DEFAULT_SITE_NAME,
      primaryNavMenuId: hasMenuId
        ? String(doc?.primaryNavMenuId).trim()
        : DEFAULT_PRIMARY_NAV_MENU_ID,
      keepLegacyPrimaryNav: true,
      features: normalizeFlags(doc),
      moduleToggles: mergedToggles,
    })
  } catch {
    const missing = mergeMissingCatalogModuleDefaults({})
    const repaired = repairCatalogModuleDefaultsOnce(missing.toggles)
    try {
      return await updateSiteSettings({
        siteName: DEFAULT_SITE_NAME,
        primaryNavMenuId: DEFAULT_PRIMARY_NAV_MENU_ID,
        keepLegacyPrimaryNav: true,
        features: { ...DEFAULT_FEATURE_FLAGS },
        moduleToggles: repaired.toggles,
      })
    } catch {
      return fallbackSettings()
    }
  }
}

/**
 * Seed primary nav via Nav manager Main menu + point site default at it.
 * Idempotent: skips when Main already has items.
 */
export async function seedPrimaryNavFromPages(
  entries: Array<{ label: string; slug: string }>,
): Promise<{ updated: boolean; primaryNav: NavItem[] }> {
  const { migrateLegacyPrimaryNavToMain, seedMainNavFromPages } = await import(
    '@/core/nav/store'
  )

  try {
    const existing = await readSiteSettingsRow()
    if (existing) {
      await migrateLegacyPrimaryNavToMain(rowToDoc(existing).primaryNav)
    }
  } catch {
    // Ignore — seedMainNavFromPages still runs.
  }

  const seeded = await seedMainNavFromPages(entries)

  try {
    const existing = await readSiteSettingsRow()
    const doc = existing ? rowToDoc(existing) : null
    const toggles = normalizeModuleToggles(doc?.moduleToggles)
    if (typeof toggles[MODULE_IDS.primaryNav] !== 'boolean') {
      toggles[MODULE_IDS.primaryNav] = true
    }

    await updateSiteSettings({
      siteName:
        typeof doc?.siteName === 'string' && doc.siteName.trim()
          ? doc.siteName.trim()
          : DEFAULT_SITE_NAME,
      primaryNavMenuId: DEFAULT_PRIMARY_NAV_MENU_ID,
      keepLegacyPrimaryNav: true,
      features: normalizeFlags(doc),
      moduleToggles: toggles,
    })
  } catch {
    // Settings row may be unavailable; menu seed still applied.
  }

  const settingsSnap = await loadSiteSettingsUncached()
  const resolved = await resolveNavMenuItems(DEFAULT_NAV_MENU_ID, settingsSnap)
  return { updated: seeded.updated, primaryNav: resolved }
}

/**
 * Public/layout gate: is this particle id enabled for the current site?
 * Required chrome (`page-content`) is always on.
 * - Stored toggle wins when present.
 * - Extension modules that used `featureFlag: 'modules'` fall back to master Modules flag.
 * - Other builtins default on when no stored row.
 */
export function isParticleModuleEnabled(
  settings: SiteSettingsData,
  moduleId: string,
  options?: { builtin?: boolean; featureFlag?: keyof FeatureFlags },
): boolean {
  const id = moduleId.trim()
  if (!id) return false
  if (REQUIRED_MODULE_IDS.has(id)) return true
  if (!isModuleAllowlisted(id)) return false

  const usesLegacyModulesFlag = options?.featureFlag === 'modules'
  return isModuleToggleEnabled(settings, id, {
    defaultEnabled: !usesLegacyModulesFlag,
    legacyModulesFlag: usesLegacyModulesFlag,
  })
}

/** Atom type gate (`analytics` → `atom:analytics`). Defaults on when unset. */
export function isAtomModuleEnabled(settings: SiteSettingsData, atomType: string): boolean {
  const toggleId = atomToggleId(atomType)
  if (!isModuleAllowlisted(toggleId)) return false
  return isModuleToggleEnabled(settings, toggleId, { defaultEnabled: true })
}
