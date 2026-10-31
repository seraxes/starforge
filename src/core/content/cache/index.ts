import { nextPublishedContentCache } from './next'
import { createRedisPublishedContentCache } from './redis'
import type { PublishedContentCache } from './types'

export { contentCacheTags } from './tags'
export type { ContentCacheGetOptions, PublishedContentCache } from './types'

/**
 * Active published-content cache backend.
 *
 * - Default / local: Next.js `unstable_cache` + tags
 * - `STARFORGE_CONTENT_CACHE=redis`: Redis (DO production) — stub until wired
 *
 * Routes and Payload hooks should not branch on this; use content helpers +
 * `invalidatePublishedPage` / `invalidateSiteSettings` instead.
 */
export function getPublishedContentCache(): PublishedContentCache {
  if (process.env.STARFORGE_CONTENT_CACHE === 'redis') {
    return createRedisPublishedContentCache()
  }
  return nextPublishedContentCache
}
