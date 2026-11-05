/**
 * Localization settings (SF-239 + P2 catalog) — public locales + default + fallback.
 * Edited under `/admin/localization`. Persisted on Site Chrome JSON for
 * continuity with the i18n P0 stub (same storage; UI no longer on Chrome).
 */

import type { LocaleCatalogEntry } from '@/core/i18n/locales'

export type { LocaleCatalogEntry }

export type LocalizationSettings = {
  /**
   * Full locale catalog (code + label). Bootstrap seeds `en`/`hu`;
   * admins may add more BCP-47-ish codes.
   */
  localeCatalog: LocaleCatalogEntry[]
  /** Enabled public locale codes (subset of `localeCatalog`). */
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
