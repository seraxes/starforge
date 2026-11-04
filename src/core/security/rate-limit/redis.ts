import 'server-only'

import { getRedisClient } from '@/core/redis'
import { redisKeyPrefix } from '@/core/redis/prefix'

import type { RateLimitConsumeOptions, RateLimitResult, RateLimiter } from './types'

function rateLimitKey(key: string): string {
  return `${redisKeyPrefix()}:rl:${key}`
}

/**
 * Redis fixed-window counter (`INCR` + `EXPIRE` on first hit).
 * Same `REDIS_URL` + `STARFORGE_REDIS_PREFIX` as the content-cache port.
 */
export function createRedisRateLimiter(): RateLimiter {
  const redis = getRedisClient()

  return {
    async consume(key, options: RateLimitConsumeOptions): Promise<RateLimitResult> {
      const windowSec = Math.max(1, options.windowSec)
      const limit = Math.max(1, options.limit)
      const fullKey = rateLimitKey(key)

      const count = await redis.incr(fullKey)
      if (count === 1) {
        await redis.expire(fullKey, windowSec)
      }

      if (count > limit) {
        const ttl = await redis.ttl(fullKey)
        return {
          ok: false,
          retryAfterSec: Math.max(1, ttl > 0 ? ttl : windowSec),
        }
      }

      return { ok: true }
    },
  }
}
