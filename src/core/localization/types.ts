/**
 * Localization settings (SF-239) — public locales + default + fallback.
 * Edited under `/admin/localization`. Persisted on Site Chrome JSON for
 * continuity with the i18n P0 stub (same storage; UI no longer on Chrome).
 */

export type LocalizationSettings = {
  /** Enabled public locale codes (subset of Core i18n catalog). */
  localesEnabled: string[]
  /** Default public locale; must be one of `localesEnabled`. */
  defaultLocale: string
  /**
   * When true, missing locale content falls back to `defaultLocale`.
   * Stored for Site Settings; Payload `localization.fallback` in
   * `payload.config.ts` remains code-configured until a later sync pass.
   */
  localeFallback: boolean
}
