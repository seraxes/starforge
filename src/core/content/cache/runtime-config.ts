/**
 * Sync snapshot of Site Settings → Performance published-cache knobs.
 *
 * The Redis / Next adapters must not call `getSiteSettings()` (that path uses
 * `getCached` and would recurse). Settings code pushes updates here after load
 * / save; cold start uses the same defaults as `site-settings`.
 */

import {
  DEFAULT_NULL_MISS_TTL_SEC,
  DEFAULT_PUBLISHED_CACHE_ENABLED,
  DEFAULT_PUBLISHED_CACHE_TTL_SEC,
  clampNullMissTtlSec,
  clampPublishedCacheTtlSec,
  coercePublishedCacheEnabled,
} from '@/core/settings/defaults'

export type PublishedCacheRuntimeConfig = {
  /** When false, bypass Next/Redis and always run the loader. */
  enabled: boolean
  /** Seconds; `0` = keep until tag invalidation. */
  ttlSec: number
  /** Redis-only null / miss marker TTL (seconds). */
  nullMissTtlSec: number
}

const DEFAULT_CONFIG: PublishedCacheRuntimeConfig = {
  enabled: DEFAULT_PUBLISHED_CACHE_ENABLED,
  ttlSec: DEFAULT_PUBLISHED_CACHE_TTL_SEC,
  nullMissTtlSec: DEFAULT_NULL_MISS_TTL_SEC,
}

let snapshot: PublishedCacheRuntimeConfig = { ...DEFAULT_CONFIG }

/** Current Performance published-cache knobs (sync; safe inside cache adapters). */
export function getPublishedCacheRuntimeConfig(): PublishedCacheRuntimeConfig {
  return snapshot
}

/** Replace the runtime snapshot (clamped). Used by Site Settings normalize/save. */
export function setPublishedCacheRuntimeConfig(
  partial: Partial<{
    enabled: unknown
    ttlSec: unknown
    nullMissTtlSec: unknown
  }>,
): PublishedCacheRuntimeConfig {
  snapshot = {
    enabled:
      partial.enabled === undefined
        ? snapshot.enabled
        : coercePublishedCacheEnabled(partial.enabled),
    ttlSec:
      partial.ttlSec === undefined
        ? snapshot.ttlSec
        : clampPublishedCacheTtlSec(partial.ttlSec),
    nullMissTtlSec:
      partial.nullMissTtlSec === undefined
        ? snapshot.nullMissTtlSec
        : clampNullMissTtlSec(partial.nullMissTtlSec),
  }
  return snapshot
}

/** Reset to code defaults (tests). */
export function resetPublishedCacheRuntimeConfig(): void {
  snapshot = { ...DEFAULT_CONFIG }
}
