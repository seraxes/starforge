import { nextPublishedContentCache } from './next'
import type { PublishedContentCache } from './types'

export { contentCacheTags } from './tags'
export type { ContentCacheGetOptions, PublishedContentCache } from './types'

let redisCache: PublishedContentCache | undefined

/**
 * Active published-content cache backend.
 *
 * - Default / local: Next.js `unstable_cache` + tags
 * - `STARFORGE_CONTENT_CACHE=redis`: Redis (`REDIS_URL`) for DO multi-instance
 *
 * Redis is loaded lazily so the local default path does not pull ioredis.
 * Routes and Payload hooks should not branch on this; use content helpers +
 * `invalidatePublishedPage` / `invalidateSiteSettings` instead.
 */
export function getPublishedContentCache(): PublishedContentCache {
  if (process.env.STARFORGE_CONTENT_CACHE === 'redis') {
    if (!redisCache) {
      // Sync factory — dynamic import is async; require keeps the port sync.
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy Redis load
      const { createRedisPublishedContentCache } = require('./redis') as typeof import('./redis')
      redisCache = createRedisPublishedContentCache()
    }
    return redisCache
  }
  return nextPublishedContentCache
}
