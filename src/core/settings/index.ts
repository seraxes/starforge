import { getPayload } from 'payload'
import { cache } from 'react'

import config from '@payload-config'

import {
  DEFAULT_FEATURE_FLAGS,
  DEFAULT_PRIMARY_NAV,
  DEFAULT_SITE_NAME,
  DEFAULT_SITE_SETTINGS,
  type FeatureFlags,
  type NavItem,
  type SiteSettingsData,
} from './defaults'

export type { FeatureFlags, NavItem, SiteSettingsData }
export {
  DEFAULT_FEATURE_FLAGS,
  DEFAULT_PRIMARY_NAV,
  DEFAULT_SITE_NAME,
  DEFAULT_SITE_SETTINGS,
}

type SiteSettingsDoc = {
  siteName?: string | null
  primaryNav?: Array<{ label?: string | null; href?: string | null; id?: string | null }> | null
  featureRegistration?: boolean | null
  featureRichEditor?: boolean | null
  featurePosts?: boolean | null
  featureModules?: boolean | null
  featureDraftPreview?: boolean | null
}

function normalizeNav(raw: SiteSettingsDoc['primaryNav']): NavItem[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_PRIMARY_NAV.map((item) => ({ ...item }))
  }

  const items = raw
    .map((item) => ({
      label: typeof item?.label === 'string' ? item.label.trim() : '',
      href: typeof item?.href === 'string' ? item.href.trim() : '',
    }))
    .filter((item) => item.label && item.href)

  return items.length > 0 ? items : DEFAULT_PRIMARY_NAV.map((item) => ({ ...item }))
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
  if (!doc) return { ...DEFAULT_SITE_SETTINGS, features: { ...DEFAULT_FEATURE_FLAGS }, primaryNav: DEFAULT_PRIMARY_NAV.map((i) => ({ ...i })) }

  const siteName =
    typeof doc.siteName === 'string' && doc.siteName.trim()
      ? doc.siteName.trim()
      : DEFAULT_SITE_NAME

  return {
    siteName,
    primaryNav: normalizeNav(doc.primaryNav),
    features: normalizeFlags(doc),
  }
}

/**
 * Load site settings (Payload global). Cached per request via React `cache`.
 * Falls back to defaults if Payload/global is unavailable.
 */
export const getSiteSettings = cache(async (): Promise<SiteSettingsData> => {
  try {
    const payload = await getPayload({ config })
    const doc = (await payload.findGlobal({
      slug: 'site-settings',
      depth: 0,
      // Public chrome + flags; global read access is open.
      overrideAccess: false,
    })) as SiteSettingsDoc

    return normalizeSiteSettings(doc)
  } catch {
    return {
      ...DEFAULT_SITE_SETTINGS,
      features: { ...DEFAULT_FEATURE_FLAGS },
      primaryNav: DEFAULT_PRIMARY_NAV.map((i) => ({ ...i })),
    }
  }
})

export async function getFeatureFlags(): Promise<FeatureFlags> {
  const settings = await getSiteSettings()
  return settings.features
}

export async function isRegistrationEnabled(): Promise<boolean> {
  const flags = await getFeatureFlags()
  return flags.registration
}

export type UpdateSiteSettingsInput = {
  siteName: string
  primaryNav: NavItem[]
  features: FeatureFlags
}

/**
 * Upsert the Payload `site-settings` global (used by core admin + seed).
 * Requires overrideAccess so core admins do not need a CMS session.
 */
export async function updateSiteSettings(input: UpdateSiteSettingsInput): Promise<SiteSettingsData> {
  const siteName = input.siteName.trim() || DEFAULT_SITE_NAME
  const primaryNav = input.primaryNav
    .map((item) => ({
      label: item.label.trim(),
      href: item.href.trim(),
    }))
    .filter((item) => item.label && item.href)

  const payload = await getPayload({ config })
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
    },
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
      depth: 0,
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
        ? normalizeNav(existing.primaryNav)
        : DEFAULT_PRIMARY_NAV.map((i) => ({ ...i })),
      features: normalizeFlags(existing),
    })
  } catch {
    return updateSiteSettings({
      siteName: DEFAULT_SITE_NAME,
      primaryNav: DEFAULT_PRIMARY_NAV.map((i) => ({ ...i })),
      features: { ...DEFAULT_FEATURE_FLAGS },
    })
  }
}
