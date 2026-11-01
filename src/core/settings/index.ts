import { getPayload } from 'payload'
import { cache } from 'react'

import config from '@payload-config'

import { contentCacheTags, getPublishedContentCache } from '@/core/content/cache'

import { resolveNavMenuItems } from '@/core/nav/resolve'
import { DEFAULT_NAV_MENU_ID } from '@/core/db'

import {
  DEFAULT_FEATURE_FLAGS,
  DEFAULT_PRIMARY_NAV,
  DEFAULT_PRIMARY_NAV_MENU_ID,
  DEFAULT_SITE_NAME,
  DEFAULT_SITE_SETTINGS,
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
  navItemsToCustomInputs,
  resolveNavItems,
  type RawNavRow,
} from './nav'

export type { FeatureFlags, ModuleToggleMap, NavItem, NavItemInput, SiteSettingsData }
export type { RawNavRow }
export {
  DEFAULT_FEATURE_FLAGS,
  DEFAULT_PRIMARY_NAV,
  DEFAULT_PRIMARY_NAV_MENU_ID,
  DEFAULT_SITE_NAME,
  DEFAULT_SITE_SETTINGS,
}
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
export {
  PRODUCT_MODULE_CATALOG,
  featureFlagsFromModuleToggles,
  isCatalogModuleEnabled,
  listInstalledModuleCatalog,
} from './module-catalog'
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
  primaryNav?: RawNavRow[] | null
  featureRegistration?: boolean | null
  featureRichEditor?: boolean | null
  featurePosts?: boolean | null
  featureModules?: boolean | null
  featureDraftPreview?: boolean | null
  moduleToggles?: Array<{ moduleId?: string | null; enabled?: boolean | null }> | null
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

export function normalizeSiteSettings(
  doc: SiteSettingsDoc | null | undefined,
  resolvedNav?: NavItem[],
): SiteSettingsData {
  if (!doc) {
    return {
      ...DEFAULT_SITE_SETTINGS,
      features: { ...DEFAULT_FEATURE_FLAGS },
      primaryNav: (resolvedNav ?? DEFAULT_PRIMARY_NAV).map((i) => ({ ...i })),
      primaryNavMenuId: DEFAULT_PRIMARY_NAV_MENU_ID,
      moduleToggles: {},
    }
  }

  const siteName =
    typeof doc.siteName === 'string' && doc.siteName.trim()
      ? doc.siteName.trim()
      : DEFAULT_SITE_NAME

  return {
    siteName,
    primaryNavMenuId: normalizePrimaryNavMenuId(doc.primaryNavMenuId),
    primaryNav: resolvedNav ?? resolveNavItems(doc.primaryNav),
    features: normalizeFlags(doc),
    moduleToggles: normalizeModuleToggles(doc.moduleToggles),
  }
}

/**
 * Prefer Nav manager menu set; fall back to legacy Payload primaryNav rows.
 */
async function resolvePrimaryNavForDoc(doc: SiteSettingsDoc): Promise<NavItem[]> {
  const menuId = normalizePrimaryNavMenuId(doc.primaryNavMenuId)
  try {
    const fromMenu = await resolveNavMenuItems(menuId)
    // Non-default fallbacks from resolveNavMenuItems still count as usable.
    if (fromMenu.length > 0) {
      // If menu resolve returned only the hard-coded DEFAULT_PRIMARY_NAV and
      // legacy rows exist with page links, prefer legacy once — then seed owns migration.
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
    const payload = await getPayload({ config })
    const doc = (await payload.findGlobal({
      slug: 'site-settings',
      depth: 1,
      // Public chrome + flags; global read access is open.
      overrideAccess: false,
    })) as SiteSettingsDoc

    const primaryNav = await resolvePrimaryNavForDoc(doc)
    return normalizeSiteSettings(doc, primaryNav)
  } catch {
    try {
      const fromMenu = await resolveNavMenuItems(DEFAULT_NAV_MENU_ID)
      return {
        ...DEFAULT_SITE_SETTINGS,
        features: { ...DEFAULT_FEATURE_FLAGS },
        primaryNav: fromMenu,
        primaryNavMenuId: DEFAULT_PRIMARY_NAV_MENU_ID,
        moduleToggles: {},
      }
    } catch {
      return {
        ...DEFAULT_SITE_SETTINGS,
        features: { ...DEFAULT_FEATURE_FLAGS },
        primaryNav: DEFAULT_PRIMARY_NAV.map((i) => ({ ...i })),
        primaryNavMenuId: DEFAULT_PRIMARY_NAV_MENU_ID,
        moduleToggles: {},
      }
    }
  }
}

/**
 * Load site settings (Payload global) for public chrome / flags.
 * Cross-request cache via published-content cache (Next tags; Redis later);
 * per-request dedupe via React `cache`. Depth 1 resolves page → slug for nav.
 * Falls back to defaults if Payload/global is unavailable.
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
  /**
   * Legacy: resolved public nav (label + href) — written as custom-URL rows.
   * Prefer Nav manager (`sf_nav_menus`) + `primaryNavMenuId`.
   */
  primaryNav?: NavItem[]
  /** Legacy: full Payload nav rows (page relationships and/or custom URLs). */
  primaryNavInputs?: NavItemInput[]
  /** When true, leave legacy `primaryNav` array unchanged on the global. */
  keepLegacyPrimaryNav?: boolean
  features: FeatureFlags
  /** Per-module / atom runtime toggles (P0). */
  moduleToggles?: ModuleToggleMap
}

function toPayloadNavData(input: UpdateSiteSettingsInput): NavItemInput[] {
  if (input.primaryNavInputs && input.primaryNavInputs.length > 0) {
    return input.primaryNavInputs
  }
  return navItemsToCustomInputs(input.primaryNav ?? [])
}

/**
 * Upsert the Payload `site-settings` global (used by core admin + seed).
 * Requires overrideAccess so core admins do not need a CMS session.
 */
export async function updateSiteSettings(input: UpdateSiteSettingsInput): Promise<SiteSettingsData> {
  const siteName = input.siteName.trim() || DEFAULT_SITE_NAME
  const primaryNavMenuId = normalizePrimaryNavMenuId(
    input.primaryNavMenuId ?? DEFAULT_PRIMARY_NAV_MENU_ID,
  )
  const moduleToggles = input.moduleToggles ?? {}

  const payload = await getPayload({ config })

  const data: Record<string, unknown> = {
    siteName,
    primaryNavMenuId,
    featureRegistration: input.features.registration,
    featureRichEditor: input.features.richEditor,
    featurePosts: input.features.posts,
    featureModules: input.features.modules,
    featureDraftPreview: input.features.draftPreview,
    moduleToggles: moduleTogglesToPayloadRows(moduleToggles),
  }

  if (!input.keepLegacyPrimaryNav) {
    data.primaryNav = toPayloadNavData(input)
  }

  // Cast: Payload generated types lag until `payload generate:types` after schema add.
  const doc = (await payload.updateGlobal({
    slug: 'site-settings',
    data,
    depth: 1,
    overrideAccess: true,
  })) as SiteSettingsDoc

  const primaryNav = await resolvePrimaryNavForDoc(doc)
  return normalizeSiteSettings(doc, primaryNav)
}

/** Ensure the global exists with sensible defaults (idempotent). */
export async function ensureSiteSettingsDefaults(): Promise<SiteSettingsData> {
  try {
    const payload = await getPayload({ config })
    const existing = (await payload.findGlobal({
      slug: 'site-settings',
      depth: 1,
      overrideAccess: true,
    })) as SiteSettingsDoc & { id?: unknown }

    const hasName = typeof existing?.siteName === 'string' && existing.siteName.trim()
    const hasMenuId =
      typeof existing?.primaryNavMenuId === 'string' && existing.primaryNavMenuId.trim()

    // Move leftover Payload primaryNav rows into sf_nav_menus Main when empty.
    try {
      const { migrateLegacyPrimaryNavToMain } = await import('@/core/nav/store')
      await migrateLegacyPrimaryNavToMain(existing.primaryNav)
    } catch {
      // Table may not exist yet (before db:core:push).
    }

    if (hasName && hasMenuId) {
      const primaryNav = await resolvePrimaryNavForDoc(existing)
      return normalizeSiteSettings(existing, primaryNav)
    }

    return updateSiteSettings({
      siteName: hasName ? String(existing.siteName).trim() : DEFAULT_SITE_NAME,
      primaryNavMenuId: hasMenuId
        ? String(existing.primaryNavMenuId).trim()
        : DEFAULT_PRIMARY_NAV_MENU_ID,
      keepLegacyPrimaryNav: true,
      features: normalizeFlags(existing),
      moduleToggles: normalizeModuleToggles(existing.moduleToggles),
    })
  } catch {
    return updateSiteSettings({
      siteName: DEFAULT_SITE_NAME,
      primaryNavMenuId: DEFAULT_PRIMARY_NAV_MENU_ID,
      keepLegacyPrimaryNav: true,
      features: { ...DEFAULT_FEATURE_FLAGS },
      moduleToggles: {},
    })
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
    const payload = await getPayload({ config })
    const existing = (await payload.findGlobal({
      slug: 'site-settings',
      depth: 1,
      overrideAccess: true,
    })) as SiteSettingsDoc
    await migrateLegacyPrimaryNavToMain(existing.primaryNav)
  } catch {
    // Ignore — seedMainNavFromPages still runs.
  }

  const seeded = await seedMainNavFromPages(entries)

  try {
    const payload = await getPayload({ config })
    const existing = (await payload.findGlobal({
      slug: 'site-settings',
      depth: 0,
      overrideAccess: true,
    })) as SiteSettingsDoc

    const toggles = normalizeModuleToggles(existing.moduleToggles)
    // Ensure Primary nav module is on so Core admin shows the Nav link.
    if (typeof toggles[MODULE_IDS.primaryNav] !== 'boolean') {
      toggles[MODULE_IDS.primaryNav] = true
    }

    await updateSiteSettings({
      siteName:
        typeof existing.siteName === 'string' && existing.siteName.trim()
          ? existing.siteName.trim()
          : DEFAULT_SITE_NAME,
      primaryNavMenuId: DEFAULT_PRIMARY_NAV_MENU_ID,
      keepLegacyPrimaryNav: true,
      features: normalizeFlags(existing),
      moduleToggles: toggles,
    })
  } catch {
    // Settings global may be unavailable; menu seed still applied.
  }

  const resolved = await resolveNavMenuItems(DEFAULT_NAV_MENU_ID)
  return { updated: seeded.updated, primaryNav: resolved }
}

async function getSiteSettingsUncached(): Promise<SiteSettingsData> {
  try {
    const payload = await getPayload({ config })
    const doc = (await payload.findGlobal({
      slug: 'site-settings',
      depth: 1,
      overrideAccess: true,
    })) as SiteSettingsDoc
    const primaryNav = await resolvePrimaryNavForDoc(doc)
    return normalizeSiteSettings(doc, primaryNav)
  } catch {
    return {
      ...DEFAULT_SITE_SETTINGS,
      features: { ...DEFAULT_FEATURE_FLAGS },
      primaryNav: DEFAULT_PRIMARY_NAV.map((i) => ({ ...i })),
      primaryNavMenuId: DEFAULT_PRIMARY_NAV_MENU_ID,
      moduleToggles: {},
    }
  }
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

  const usesLegacyModulesFlag = options?.featureFlag === 'modules'
  return isModuleToggleEnabled(settings, id, {
    defaultEnabled: !usesLegacyModulesFlag,
    legacyModulesFlag: usesLegacyModulesFlag,
  })
}

/** Atom type gate (`analytics` → `atom:analytics`). Defaults on when unset. */
export function isAtomModuleEnabled(settings: SiteSettingsData, atomType: string): boolean {
  return isModuleToggleEnabled(settings, atomToggleId(atomType), { defaultEnabled: true })
}

