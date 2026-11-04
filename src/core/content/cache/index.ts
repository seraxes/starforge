import { nextPublishedContentCache } from './next'
import { getPublishedCacheRuntimeConfig } from './runtime-config'
import type { ContentCacheGetOptions, PublishedContentCache } from './types'

export { contentCacheTags } from './tags'
export type { ContentCacheGetOptions, PublishedContentCache } from './types'
export type { PublishedCacheRuntimeConfig } from './runtime-config'
export {
  getPublishedCacheRuntimeConfig,
  resetPublishedCacheRuntimeConfig,
  setPublishedCacheRuntimeConfig,
} from './runtime-config'

let redisCache: PublishedContentCache | undefined

/** Always-load adapter when Site Settings → Performance disables content cache. */
const passthroughPublishedContentCache: PublishedContentCache = {
  getCached<T>(_options: ContentCacheGetOptions, loader: () => Promise<T>): Promise<T> {
    return loader()
  },
  async invalidateTags(): Promise<void> {
    // No cross-request entries when cache is off.
  },
}

/**
 * Apply Performance TTL when the caller left revalidate unset / false.
 * Explicit positive `revalidate` from the caller still wins.
 */
function withPerformanceTtl(options: ContentCacheGetOptions): ContentCacheGetOptions {
  if (typeof options.revalidate === 'number' && options.revalidate > 0) {
    return options
  }
  const ttlSec = getPublishedCacheRuntimeConfig().ttlSec
  if (ttlSec > 0) {
    return { ...options, revalidate: ttlSec }
  }
  return { ...options, revalidate: false }
}

function wrapBackend(backend: PublishedContentCache): PublishedContentCache {
  return {
    getCached<T>(options: ContentCacheGetOptions, loader: () => Promise<T>): Promise<T> {
      return backend.getCached(withPerformanceTtl(options), loader)
    },
    invalidateTags(tags: readonly string[]): void | Promise<void> {
      return backend.invalidateTags(tags)
    },
  }
}

/**
 * Active published-content cache backend.
 *
 * - Site Settings → Performance can disable caching (passthrough).
 * - Default / local: Next.js `unstable_cache` + tags
 * - `STARFORGE_CONTENT_CACHE=redis`: Redis (`REDIS_URL`) for DO multi-instance
 *
 * Redis is loaded lazily so the local default path does not pull ioredis.
 * Routes and Payload hooks should not branch on this; use content helpers +
 * `invalidatePublishedPage` / `invalidateSiteSettings` instead.
 */
export function getPublishedContentCache(): PublishedContentCache {
  if (!getPublishedCacheRuntimeConfig().enabled) {
    return passthroughPublishedContentCache
  }
  if (process.env.STARFORGE_CONTENT_CACHE === 'redis') {
    if (!redisCache) {
      // Sync factory — dynamic import is async; require keeps the port sync.
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy Redis load
      const { createRedisPublishedContentCache } = require('./redis') as typeof import('./redis')
      redisCache = createRedisPublishedContentCache()
    }
    return wrapBackend(redisCache)
  }
  return wrapBackend(nextPublishedContentCache)
}
