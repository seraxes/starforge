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
  /**
   * View access tags (`public` / `registered` / `group:<id>`).
   * Visible if the viewer matches **any** tag (OR).
   */
  accessTags?: string[]
  /** @deprecated Prefer `accessTags`; still read for legacy single-value rows. */
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

/** Default Core admin field autosave debounce (ms). */
export const DEFAULT_ADMIN_AUTOSAVE_DEBOUNCE_MS = 800
/** Inclusive lower bound for Site Settings → admin autosave debounce. */
export const ADMIN_AUTOSAVE_DEBOUNCE_MIN_MS = 300
/** Inclusive upper bound for Site Settings → admin autosave debounce. */
export const ADMIN_AUTOSAVE_DEBOUNCE_MAX_MS = 2000

/** Clamp / coerce Site Settings admin autosave debounce (ms). */
export function clampAdminAutosaveDebounceMs(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n)) return DEFAULT_ADMIN_AUTOSAVE_DEBOUNCE_MS
  return Math.min(
    ADMIN_AUTOSAVE_DEBOUNCE_MAX_MS,
    Math.max(ADMIN_AUTOSAVE_DEBOUNCE_MIN_MS, Math.round(n)),
  )
}

/**
 * Default Form submit rate-limit max (per IP + formKey window).
 * Prefer Site Settings → Performance; keep these as code fallbacks only.
 */
export const DEFAULT_FORM_RATE_LIMIT_MAX = 8
/** Inclusive lower bound for Form rate-limit max. */
export const FORM_RATE_LIMIT_MAX_MIN = 1
/** Inclusive upper bound for Form rate-limit max. */
export const FORM_RATE_LIMIT_MAX_MAX = 100

/** Default Form submit rate-limit window (seconds). */
export const DEFAULT_FORM_RATE_LIMIT_WINDOW_SEC = 60
/** Inclusive lower bound for Form rate-limit window (seconds). */
export const FORM_RATE_LIMIT_WINDOW_SEC_MIN = 10
/** Inclusive upper bound for Form rate-limit window (seconds). */
export const FORM_RATE_LIMIT_WINDOW_SEC_MAX = 3600

function coerceFiniteNumber(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(n) ? n : null
}

/** Clamp / coerce Site Settings Form rate-limit max. */
export function clampFormRateLimitMax(raw: unknown): number {
  const n = coerceFiniteNumber(raw)
  if (n == null) return DEFAULT_FORM_RATE_LIMIT_MAX
  return Math.min(
    FORM_RATE_LIMIT_MAX_MAX,
    Math.max(FORM_RATE_LIMIT_MAX_MIN, Math.round(n)),
  )
}

/** Clamp / coerce Site Settings Form rate-limit window (seconds). */
export function clampFormRateLimitWindowSec(raw: unknown): number {
  const n = coerceFiniteNumber(raw)
  if (n == null) return DEFAULT_FORM_RATE_LIMIT_WINDOW_SEC
  return Math.min(
    FORM_RATE_LIMIT_WINDOW_SEC_MAX,
    Math.max(FORM_RATE_LIMIT_WINDOW_SEC_MIN, Math.round(n)),
  )
}

/**
 * Default: published-content cache on. Off bypasses Next/Redis adapters (loader
 * every time). Backend selection (`STARFORGE_CONTENT_CACHE` / `REDIS_URL`) stays
 * in Environment — this is only the non-secret on/off knob.
 */
export const DEFAULT_PUBLISHED_CACHE_ENABLED = true

/**
 * Default published-content TTL (seconds). `0` = keep until tag invalidation
 * (preferred for CMS). Positive values add a time-based safety net.
 */
export const DEFAULT_PUBLISHED_CACHE_TTL_SEC = 0
/** Inclusive lower bound for published-content TTL (0 = tag-only). */
export const PUBLISHED_CACHE_TTL_SEC_MIN = 0
/** Inclusive upper bound for published-content TTL (24h). */
export const PUBLISHED_CACHE_TTL_SEC_MAX = 86_400

/** Default Redis null-miss TTL (seconds) for cached empty published reads. */
export const DEFAULT_NULL_MISS_TTL_SEC = 60
/** Inclusive lower bound for null-miss TTL. */
export const NULL_MISS_TTL_SEC_MIN = 1
/** Inclusive upper bound for null-miss TTL. */
export const NULL_MISS_TTL_SEC_MAX = 3600

function coerceBool(raw: unknown, fallback: boolean): boolean {
  if (raw == null) return fallback
  if (typeof raw === 'boolean') return raw
  if (typeof raw === 'number') return raw !== 0
  if (typeof raw === 'string') {
    const v = raw.trim().toLowerCase()
    if (v === 'true' || v === '1' || v === 'on' || v === 'yes') return true
    if (v === 'false' || v === '0' || v === 'off' || v === 'no' || v === '') return false
  }
  return fallback
}

/** Coerce Site Settings published-content cache enable flag. */
export function coercePublishedCacheEnabled(raw: unknown): boolean {
  return coerceBool(raw, DEFAULT_PUBLISHED_CACHE_ENABLED)
}

/** Default: RealtimePort SSE / publish on (Site Settings → Performance). */
export const DEFAULT_REALTIME_ENABLED = true

/** Coerce Site Settings RealtimePort enable flag. */
export function coerceRealtimeEnabled(raw: unknown): boolean {
  return coerceBool(raw, DEFAULT_REALTIME_ENABLED)
}

/** Clamp / coerce Site Settings published-content TTL (seconds). */
export function clampPublishedCacheTtlSec(raw: unknown): number {
  const n = coerceFiniteNumber(raw)
  if (n == null) return DEFAULT_PUBLISHED_CACHE_TTL_SEC
  return Math.min(
    PUBLISHED_CACHE_TTL_SEC_MAX,
    Math.max(PUBLISHED_CACHE_TTL_SEC_MIN, Math.round(n)),
  )
}

/** Clamp / coerce Site Settings Redis null-miss TTL (seconds). */
export function clampNullMissTtlSec(raw: unknown): number {
  const n = coerceFiniteNumber(raw)
  if (n == null) return DEFAULT_NULL_MISS_TTL_SEC
  return Math.min(
    NULL_MISS_TTL_SEC_MAX,
    Math.max(NULL_MISS_TTL_SEC_MIN, Math.round(n)),
  )
}

/**
 * Dashboard soft-refresh interval (seconds). Site Settings → Performance.
 * `/admin` client poll / `router.refresh` honors this knob (D4).
 */
export const DEFAULT_DASHBOARD_REFRESH_INTERVAL_SEC = 60
export const DASHBOARD_REFRESH_INTERVAL_SEC_MIN = 15
export const DASHBOARD_REFRESH_INTERVAL_SEC_MAX = 600

/** Online-now session activity window (minutes). Site Settings → Performance. */
export const DEFAULT_DASHBOARD_ONLINE_WINDOW_MIN = 15
export const DASHBOARD_ONLINE_WINDOW_MIN_MIN = 5
export const DASHBOARD_ONLINE_WINDOW_MIN_MAX = 120

export function clampDashboardRefreshIntervalSec(raw: unknown): number {
  const n = coerceFiniteNumber(raw)
  if (n == null) return DEFAULT_DASHBOARD_REFRESH_INTERVAL_SEC
  return Math.min(
    DASHBOARD_REFRESH_INTERVAL_SEC_MAX,
    Math.max(DASHBOARD_REFRESH_INTERVAL_SEC_MIN, Math.round(n)),
  )
}

export function clampDashboardOnlineWindowMin(raw: unknown): number {
  const n = coerceFiniteNumber(raw)
  if (n == null) return DEFAULT_DASHBOARD_ONLINE_WINDOW_MIN
  return Math.min(
    DASHBOARD_ONLINE_WINDOW_MIN_MAX,
    Math.max(DASHBOARD_ONLINE_WINDOW_MIN_MIN, Math.round(n)),
  )
}

export type SiteSettingsData = {
  siteName: string
  /**
   * Resolved public primary nav (from Nav manager menu set, or legacy
   * `site-settings.primaryNav` fallback).
   */
  primaryNav: NavItem[]
  /** Which `sf_nav_menus` id powers the public primary nav (site default). */
  primaryNavMenuId: string
  /**
   * Core `/admin` text-field autosave debounce (ms). Blur still flushes
   * immediately. Clamped to {@link ADMIN_AUTOSAVE_DEBOUNCE_MIN_MS}–
   * {@link ADMIN_AUTOSAVE_DEBOUNCE_MAX_MS}.
   */
  adminAutosaveDebounceMs: number
  /**
   * Max Form submissions per IP + formKey within
   * {@link formRateLimitWindowSec}. Site Settings → Performance.
   */
  formRateLimitMax: number
  /**
   * Form submit rate-limit window in seconds. Site Settings → Performance.
   * Redis URL / cache backend stay in env (Environment), not here.
   */
  formRateLimitWindowSec: number
  /**
   * When false, published-content cache adapters are bypassed (always load).
   * Site Settings → Performance. Not Redis URL / backend enum.
   */
  publishedCacheEnabled: boolean
  /**
   * Published-content TTL in seconds (`0` = until tag invalidate).
   * Site Settings → Performance.
   */
  publishedCacheTtlSec: number
  /**
   * Redis null-miss marker TTL in seconds. Site Settings → Performance.
   * Ignored by the Next.js tag cache.
   */
  nullMissTtlSec: number
  /**
   * Dashboard soft-refresh interval (seconds). Site Settings → Performance.
   * Host reads this in D0; client poll / RSC refresh is D4.
   */
  dashboardRefreshIntervalSec: number
  /**
   * “Online now” session activity window (minutes). Site Settings → Performance.
   */
  dashboardOnlineWindowMin: number
  /**
   * When false, RealtimePort publish is a no-op fan-out and SSE refuses connections.
   * Site Settings → Performance. Redis fanout (later) stays env-selected.
   */
  realtimeEnabled: boolean
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
  adminAutosaveDebounceMs: DEFAULT_ADMIN_AUTOSAVE_DEBOUNCE_MS,
  formRateLimitMax: DEFAULT_FORM_RATE_LIMIT_MAX,
  formRateLimitWindowSec: DEFAULT_FORM_RATE_LIMIT_WINDOW_SEC,
  publishedCacheEnabled: DEFAULT_PUBLISHED_CACHE_ENABLED,
  publishedCacheTtlSec: DEFAULT_PUBLISHED_CACHE_TTL_SEC,
  nullMissTtlSec: DEFAULT_NULL_MISS_TTL_SEC,
  dashboardRefreshIntervalSec: DEFAULT_DASHBOARD_REFRESH_INTERVAL_SEC,
  dashboardOnlineWindowMin: DEFAULT_DASHBOARD_ONLINE_WINDOW_MIN,
  realtimeEnabled: DEFAULT_REALTIME_ENABLED,
  features: { ...DEFAULT_FEATURE_FLAGS },
  moduleToggles: {},
}
