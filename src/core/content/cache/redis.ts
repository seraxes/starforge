import type { PublishedContentCache } from './types'

/**
 * Placeholder for a Redis-backed published-content cache (DigitalOcean / multi-instance).
 *
 * Not required locally. When wired:
 * - Implement get/set + tag→key index (or Redis Sets per tag)
 * - Honor the same `ContentCacheGetOptions.key` / `.tags` contract
 * - Select via `getPublishedContentCache()` when `STARFORGE_CONTENT_CACHE=redis`
 *
 * Callers must keep using `getPublishedPageBySlug` / `getSiteSettings` — do not
 * call Redis from routes or Payload hooks directly.
 */
export function createRedisPublishedContentCache(): PublishedContentCache {
  throw new Error(
    'Redis published-content cache is not implemented yet. Planned for DigitalOcean; use the Next.js cache locally (default).',
  )
}
