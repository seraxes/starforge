import 'server-only'

import type Redis from 'ioredis'

import { getRedisClient } from '@/core/redis'

import type { ContentCacheGetOptions, PublishedContentCache } from './types'

/** Value keys: sf:pcc:v:{joined key parts} */
const VALUE_PREFIX = 'sf:pcc:v:'
/** Tag → value-key sets: sf:pcc:t:{tag} */
const TAG_PREFIX = 'sf:pcc:t:'

function valueKey(parts: readonly string[]): string {
  return `${VALUE_PREFIX}${parts.join(':')}`
}

function tagSetKey(tag: string): string {
  return `${TAG_PREFIX}${tag}`
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
 * - Same `ContentCacheGetOptions.key` / `.tags` contract as the Next adapter
 * - Tag index = Redis Sets; invalidation deletes member keys + the set
 * - Local default stays Next/tag — leave `STARFORGE_CONTENT_CACHE` unset
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
        const ttl = options.revalidate
        if (typeof ttl === 'number' && ttl > 0) {
          pipeline.set(key, payload, 'EX', ttl)
        } else {
          pipeline.set(key, payload)
        }
        for (const tag of options.tags) {
          pipeline.sadd(tagSetKey(tag), key)
        }
        await pipeline.exec()
      } catch {
        // Write failure is non-fatal — return fresh value.
      }

      return value
    },

    invalidateTags(tags: readonly string[]): void {
      // Interface is sync (matches Next `revalidateTag`); fire-and-forget Redis work.
      void invalidateTagsAsync(redis, tags).catch(() => {
        // Hooks / seed may run when Redis is unreachable; ignore quietly.
      })
    },
  }

  return cachedAdapter
}
