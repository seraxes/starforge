import { getPayload } from 'payload'
import { cache } from 'react'

import config from '@payload-config'

import { contentCacheTags, getPublishedContentCache } from '@/core/content/cache'

import {
  DEFAULT_FEATURE_FLAGS,
  DEFAULT_PRIMARY_NAV,
  DEFAULT_SITE_NAME,
  DEFAULT_SITE_SETTINGS,
  type FeatureFlags,
  type ModuleToggleMap,
  type NavItem,
  type NavItemInput,
  type SiteSettingsData,
} from './defaults'
import {
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
  primaryNav?: RawNavRow[] | null
  featureRegistration?: boolean | null
  featureRichEditor?: boolean | null
  featurePosts?: boolean | null
  featureModules?: boolean | null
  featureDraftPreview?: boolean | null
  moduleToggles?: Array<{ moduleId?: string | null; enabled?: boolean | null }> | null
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

export function normalizeSiteSettings(doc: SiteSettingsDoc | null | undefined): SiteSettingsData {
  if (!doc) {
    return {
      ...DEFAULT_SITE_SETTINGS,
      features: { ...DEFAULT_FEATURE_FLAGS },
      primaryNav: DEFAULT_PRIMARY_NAV.map((i) => ({ ...i })),
      moduleToggles: {},
    }
  }

  const siteName =
    typeof doc.siteName === 'string' && doc.siteName.trim()
      ? doc.siteName.trim()
      : DEFAULT_SITE_NAME

  return {
    siteName,
    primaryNav: resolveNavItems(doc.primaryNav),
    features: normalizeFlags(doc),
    moduleToggles: normalizeModuleToggles(doc.moduleToggles),
  }
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

    return normalizeSiteSettings(doc)
  } catch {
    return {
      ...DEFAULT_SITE_SETTINGS,
      features: { ...DEFAULT_FEATURE_FLAGS },
      primaryNav: DEFAULT_PRIMARY_NAV.map((i) => ({ ...i })),
      moduleToggles: {},
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
  /**
   * Resolved public nav (label + href) — written as custom-URL rows.
   * Prefer `primaryNavInputs` when seeding page relationships.
   */
  primaryNav?: NavItem[]
  /** Full Payload nav rows (page relationships and/or custom URLs). */
  primaryNavInputs?: NavItemInput[]
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
  const primaryNav = toPayloadNavData(input)
  const moduleToggles = input.moduleToggles ?? {}

  const payload = await getPayload({ config })
  // Cast: Payload generated types lag until `payload generate:types` after schema add.
  const doc = (await payload.updateGlobal({
    slug: 'site-settings',
    data: {
      siteName,
      primaryNav,
      featureRegistration: input.features.registration,
      featureRichEditor: input.features.richEditor,
      featurePosts: input.features.posts,
      featureModules: input.features.modules,
      featureDraftPreview: input.features.draftPreview,
      moduleToggles: moduleTogglesToPayloadRows(moduleToggles),
    } as Record<string, unknown>,
    depth: 1,
    overrideAccess: true,
  })) as SiteSettingsDoc

  return normalizeSiteSettings(doc)
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
    const hasNav = Array.isArray(existing?.primaryNav) && existing.primaryNav.length > 0

    if (hasName && hasNav) {
      return normalizeSiteSettings(existing)
    }

    return updateSiteSettings({
      siteName: hasName ? String(existing.siteName).trim() : DEFAULT_SITE_NAME,
      primaryNav: hasNav
        ? resolveNavItems(existing.primaryNav)
        : DEFAULT_PRIMARY_NAV.map((i) => ({ ...i })),
      features: normalizeFlags(existing),
      moduleToggles: normalizeModuleToggles(existing.moduleToggles),
    })
  } catch {
    return updateSiteSettings({
      siteName: DEFAULT_SITE_NAME,
      primaryNav: DEFAULT_PRIMARY_NAV.map((i) => ({ ...i })),
      features: { ...DEFAULT_FEATURE_FLAGS },
      moduleToggles: {},
    })
  }
}

/**
 * Point primary nav at published sample pages by relationship (seed).
 * Idempotent: skips when page links already exist, or when nav was customized
 * beyond the sample page paths.
 */
export async function seedPrimaryNavFromPages(
  entries: Array<{ label: string; slug: string }>,
): Promise<{ updated: boolean; primaryNav: NavItem[] }> {
  const payload = await getPayload({ config })
  const existing = (await payload.findGlobal({
    slug: 'site-settings',
    depth: 0,
    overrideAccess: true,
  })) as SiteSettingsDoc

  const sampleHrefs = new Set(entries.map((e) => `/${e.slug}`))
  const resolvedExisting = resolveNavItems(existing.primaryNav)
  const hasRows = Array.isArray(existing.primaryNav) && existing.primaryNav.length > 0
  const onlySamplePaths =
    !hasRows ||
    (resolvedExisting.length > 0 &&
      resolvedExisting.every((item) => sampleHrefs.has(item.href) || item.href === '/'))

  if (navHasPageLinks(existing.primaryNav) || (hasRows && !onlySamplePaths)) {
    const resolved = await getSiteSettingsUncached()
    return { updated: false, primaryNav: resolved.primaryNav }
  }

  const inputs: NavItemInput[] = []
  for (const entry of entries) {
    const found = await payload.find({
      collection: 'pages',
      where: { slug: { equals: entry.slug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const doc = found.docs[0]
    if (!doc || typeof doc.id !== 'number') continue
    inputs.push({
      label: entry.label,
      linkType: 'page',
      page: doc.id,
    })
  }

  if (inputs.length === 0) {
    const fallback = await ensureSiteSettingsDefaults()
    return { updated: false, primaryNav: fallback.primaryNav }
  }

  const next = await updateSiteSettings({
    siteName:
      typeof existing.siteName === 'string' && existing.siteName.trim()
        ? existing.siteName.trim()
        : DEFAULT_SITE_NAME,
    primaryNavInputs: inputs,
    features: normalizeFlags(existing),
    moduleToggles: normalizeModuleToggles(existing.moduleToggles),
  })

  return { updated: true, primaryNav: next.primaryNav }
}

async function getSiteSettingsUncached(): Promise<SiteSettingsData> {
  try {
    const payload = await getPayload({ config })
    const doc = (await payload.findGlobal({
      slug: 'site-settings',
      depth: 1,
      overrideAccess: true,
    })) as SiteSettingsDoc
    return normalizeSiteSettings(doc)
  } catch {
    return {
      ...DEFAULT_SITE_SETTINGS,
      features: { ...DEFAULT_FEATURE_FLAGS },
      primaryNav: DEFAULT_PRIMARY_NAV.map((i) => ({ ...i })),
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

