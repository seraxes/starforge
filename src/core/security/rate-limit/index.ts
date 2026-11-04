import { clearMemoryRateLimitBuckets, createMemoryRateLimiter } from './memory'
import type { RateLimiter } from './types'

export type { RateLimitConsumeOptions, RateLimitResult, RateLimiter } from './types'
export { clearMemoryRateLimitBuckets, createMemoryRateLimiter } from './memory'

let memoryLimiter: RateLimiter | undefined
let redisLimiter: RateLimiter | undefined

function redisConfigured(): boolean {
  // Inline env read so the memory path stays free of `server-only` / ioredis.
  return Boolean((process.env.REDIS_URL ?? '').trim())
}

/**
 * Active RateLimiter.
 *
 * - No `REDIS_URL`: in-memory (local / single process)
 * - `REDIS_URL` set: Redis adapter for multi-instance (DO)
 *
 * Redis is loaded lazily so the memory path does not pull ioredis.
 */
export function getRateLimiter(): RateLimiter {
  if (redisConfigured()) {
    if (!redisLimiter) {
      // Sync factory — dynamic import is async; require keeps the port sync.
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy Redis load
      const { createRedisRateLimiter } = require('./redis') as typeof import('./redis')
      redisLimiter = createRedisRateLimiter()
    }
    return redisLimiter
  }

  if (!memoryLimiter) {
    memoryLimiter = createMemoryRateLimiter()
  }
  return memoryLimiter
}

/** Reset singletons + memory buckets (tests). */
export function resetRateLimiterForTests(): void {
  memoryLimiter = undefined
  redisLimiter = undefined
  clearMemoryRateLimitBuckets()
}
