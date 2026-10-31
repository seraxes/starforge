/**
 * Defaults when the Payload `site-settings` global is missing or empty.
 * Keep in sync with `src/globals/SiteSettings.ts` field defaults.
 *
 * Public layout consumes resolved `{ label, href }` only. Payload stores
 * page relationships / custom URLs; core resolves them in `getSiteSettings`.
 */

export type NavItem = {
  label: string
  /** Resolved path (`/about`) or absolute URL. */
  href: string
}

/** Shape written back to Payload (core admin + seed). */
export type NavItemInput =
  | {
      label: string
      linkType: 'page'
      /** Payload pages document id (Postgres numeric). */
      page: number
      cssClass?: string
      browserTitle?: string
    }
  | {
      label: string
      linkType: 'custom'
      url: string
      cssClass?: string
      browserTitle?: string
    }

export type FeatureFlags = {
  registration: boolean
  richEditor: boolean
  posts: boolean
  /**
   * Master “any extension modules” flag (kept for backward compat).
   * Site Settings → Modules per-id toggles are the source of truth in P0;
   * this stays true when any extension particle is enabled.
   */
  modules: boolean
  draftPreview: boolean
}

/** Per installed module/atom id → enabled (see `module-toggles.ts`). */
export type ModuleToggleMap = Record<string, boolean>

export type SiteSettingsData = {
  siteName: string
  primaryNav: NavItem[]
  features: FeatureFlags
  /** Runtime gates for registered particles + atoms (`atom:` prefix). */
  moduleToggles: ModuleToggleMap
}

export const DEFAULT_SITE_NAME = 'Starforge'

/** Fallback header links when the global has no usable nav rows. */
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
  moduleToggles: {},
}
