import 'server-only'

import type Redis from 'ioredis'

import { getRedisClient } from '@/core/redis'

import type { ContentCacheGetOptions, PublishedContentCache } from './types'

/** Short TTL for cached null / miss markers so random slug probes do not stick forever. */
const NULL_MISS_TTL_SECONDS = 60

/**
 * Key prefix so staging and prod can share one Redis safely.
 * Default: `sf:${NODE_ENV}` (e.g. `sf:production`). Override with STARFORGE_REDIS_PREFIX.
 */
export function redisKeyPrefix(): string {
  const raw = (process.env.STARFORGE_REDIS_PREFIX ?? '').trim()
  if (raw) return raw.replace(/:+$/, '')
  const env = (process.env.NODE_ENV ?? 'development').trim() || 'development'
  return `sf:${env}`
}

function valueKey(parts: readonly string[]): string {
  return `${redisKeyPrefix()}:pcc:v:${parts.join(':')}`
}

function tagSetKey(tag: string): string {
  return `${redisKeyPrefix()}:pcc:t:${tag}`
}

async function invalidateTagsAsync(redis: Redis, tags: readonly string[]): Promise<void> {
  for (const tag of tags) {
    const setKey = tagSetKey(tag)
    const members = await redis.smembers(setKey)
    if (members.length > 0) {
      await redis.del(...members, setKey)
    } else {
      await redis.del(setKey)
    }
  }
}

let cachedAdapter: PublishedContentCache | null = null

/**
 * Redis-backed published-content cache for multi-instance (DigitalOcean).
 *
 * - Selected via `STARFORGE_CONTENT_CACHE=redis` + `REDIS_URL`
 * - Keys prefixed with `STARFORGE_REDIS_PREFIX` (default `sf:${NODE_ENV}`)
 * - Null loader results get a short TTL (null-miss) so probes do not linger
 * - Tag index = Redis Sets; invalidation deletes member keys + the set
 *
 * Callers keep using `getPublishedPageBySlug` / `getSiteSettings` — do not
 * call Redis from routes or Payload hooks directly.
 */
export function createRedisPublishedContentCache(): PublishedContentCache {
  if (cachedAdapter) {
    return cachedAdapter
  }

  const redis = getRedisClient()

  cachedAdapter = {
    async getCached<T>(options: ContentCacheGetOptions, loader: () => Promise<T>): Promise<T> {
      const key = valueKey(options.key)

      try {
        const hit = await redis.get(key)
        if (hit !== null) {
          return JSON.parse(hit) as T
        }
      } catch {
        // Redis down / bad JSON — fall through to loader so public pages still render.
      }

      const value = await loader()

      try {
        const payload = JSON.stringify(value)
        const pipeline = redis.pipeline()
        const memberTtl =
          value === null || value === undefined
            ? NULL_MISS_TTL_SECONDS
            : typeof options.revalidate === 'number' && options.revalidate > 0
              ? options.revalidate
              : null

        if (memberTtl != null) {
          pipeline.set(key, payload, 'EX', memberTtl)
        } else {
          pipeline.set(key, payload)
        }

        let longestTtl = memberTtl ?? 0
        for (const tag of options.tags) {
          const setKey = tagSetKey(tag)
          pipeline.sadd(setKey, key)
          if (longestTtl > 0) {
            // Keep the tag set at least as long as the member we just wrote.
            pipeline.expire(setKey, Math.max(longestTtl, NULL_MISS_TTL_SECONDS))
          }
        }
        await pipeline.exec()
      } catch {
        // Write failure is non-fatal — return fresh value.
      }

      return value
    },

    invalidateTags(tags: readonly string[]): void {
      // Interface is sync (matches Next `revalidateTag`); fire-and-forget Redis work.
      // Follow-up (design §4): return Promise + await from hooks/actions.
      void invalidateTagsAsync(redis, tags).catch(() => {
        // Hooks / seed may run when Redis is unreachable; ignore quietly.
      })
    },
  }

  return cachedAdapter
}
