/**
 * Defaults when the Payload `site-settings` global is missing or empty.
 * Keep in sync with `src/globals/SiteSettings.ts` field defaults.
 */

export type NavItem = {
  label: string
  href: string
}

export type FeatureFlags = {
  registration: boolean
  richEditor: boolean
  posts: boolean
  modules: boolean
  draftPreview: boolean
}

export type SiteSettingsData = {
  siteName: string
  primaryNav: NavItem[]
  features: FeatureFlags
}

export const DEFAULT_SITE_NAME = 'Starforge'

export const DEFAULT_PRIMARY_NAV: NavItem[] = [
  { label: 'About', href: '/about' },
  { label: 'Getting started', href: '/getting-started' },
]

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  registration: true,
  richEditor: true,
  posts: false,
  modules: false,
  draftPreview: false,
}

export const DEFAULT_SITE_SETTINGS: SiteSettingsData = {
  siteName: DEFAULT_SITE_NAME,
  primaryNav: DEFAULT_PRIMARY_NAV,
  features: { ...DEFAULT_FEATURE_FLAGS },
}
