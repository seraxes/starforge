import type { SecondaryStorage } from 'better-auth'
import type Redis from 'ioredis'

import { redisKeyPrefix } from '@/core/redis/prefix'

/** Better Auth secondary-storage keys: `{prefix}:ba:*` (design-data-deploy §4). */
export function authSecondaryStorageKey(key: string): string {
  return `${redisKeyPrefix()}:ba:${key}`
}

type RedisSecondaryClient = Pick<Redis, 'get' | 'set' | 'del' | 'getdel' | 'multi'>

/**
 * Better Auth `SecondaryStorage` over an ioredis-compatible client.
 * Used for short-lived auth data + `rateLimit.storage: 'secondary-storage'`.
 */
export function createSecondaryStorage(redis: RedisSecondaryClient): SecondaryStorage {
  return {
    async get(key) {
      return redis.get(authSecondaryStorageKey(key))
    },

    async getAndDelete(key) {
      const fullKey = authSecondaryStorageKey(key)
      try {
        return await redis.getdel(fullKey)
      } catch {
        // Redis < 6.2: fall back to get + del (not atomic).
        const value = await redis.get(fullKey)
        if (value !== null) await redis.del(fullKey)
        return value
      }
    },

    async increment(key, ttl) {
      if (!Number.isInteger(ttl) || ttl <= 0) {
        throw new TypeError('Redis increment TTL must be a positive integer')
      }
      const fullKey = authSecondaryStorageKey(key)
      const results = await redis.multi().incr(fullKey).expire(fullKey, ttl, 'NX').exec()
      if (!results) {
        throw new Error('Redis MULTI/EXEC returned null (transaction aborted)')
      }
      const [incrErr, incrVal] = results[0] ?? []
      if (incrErr) throw incrErr
      return Number(incrVal)
    },

    async set(key, value, ttl) {
      const fullKey = authSecondaryStorageKey(key)
      if (ttl) await redis.set(fullKey, value, 'EX', ttl)
      else await redis.set(fullKey, value)
    },

    async delete(key) {
      await redis.del(authSecondaryStorageKey(key))
    },
  }
}
