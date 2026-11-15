/**
 * Payload `site_settings` column heal is retired.
 * Site settings live on Core `sf_site_settings` (migration `0043_site_settings`).
 * Day-to-day reads and writes do not ALTER or SELECT the Payload global.
 *
 * {@link ensureSiteSettingsSchemaHealed} stays as a no-op so older callers compile.
 * `npm run db:migrate` checks {@link SITE_SETTINGS_CORE_VERIFY_COLUMNS} on
 * `public.sf_site_settings` after Core and Payload migrate.
 */

/** Columns `db:migrate` verifies on `public.sf_site_settings`. */
export const SITE_SETTINGS_CORE_VERIFY_COLUMNS = [
  'site_name',
  'primary_nav_menu_id',
  'admin_autosave_debounce_ms',
  'form_rate_limit_max',
  'form_rate_limit_window_sec',
  'published_cache_enabled',
  'published_cache_ttl_sec',
  'null_miss_ttl_sec',
  'dashboard_refresh_interval_sec',
  'dashboard_online_window_min',
  'realtime_enabled',
  'feature_registration',
  'feature_modules',
  'module_toggles',
  'legacy_primary_nav',
  'payload_copied_at',
] as const

export type SiteSettingsSchemaHealResult = {
  /** Always false — this path no longer applies schema changes. */
  healed: boolean
  /** Always true — Payload heal is skipped. */
  skipped: boolean
}

/** @deprecated Payload heal retired. Returns skipped without touching the database. */
export async function healSiteSettingsSchema(): Promise<SiteSettingsSchemaHealResult> {
  return { healed: false, skipped: true }
}

/** @deprecated Payload heal retired. Settings reads do not call this. */
export async function ensureSiteSettingsSchemaHealed(): Promise<SiteSettingsSchemaHealResult> {
  return { healed: false, skipped: true }
}
