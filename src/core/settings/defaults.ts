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
  /** Optional HTML class on the public link (from Nav manager). */
  cssClass?: string
  /** Browser tab title override when this item’s path is active. */
  browserTitle?: string
  /** On-page H1 override when this item’s path is active. */
  pageHeading?: string
  /** Access level (`public` / `registered` / `group:<id>`) — filtered for the viewer. */
  accessLevel?: string
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
  /**
   * Resolved public primary nav (from Nav manager menu set, or legacy
   * `site-settings.primaryNav` fallback).
   */
  primaryNav: NavItem[]
  /** Which `sf_nav_menus` id powers the public primary nav (site default). */
  primaryNavMenuId: string
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

/** Default Nav manager menu set id (`sf_nav_menus.main`). */
export const DEFAULT_PRIMARY_NAV_MENU_ID = 'main'

export const DEFAULT_SITE_SETTINGS: SiteSettingsData = {
  siteName: DEFAULT_SITE_NAME,
  primaryNav: DEFAULT_PRIMARY_NAV,
  primaryNavMenuId: DEFAULT_PRIMARY_NAV_MENU_ID,
  features: { ...DEFAULT_FEATURE_FLAGS },
  moduleToggles: {},
}
