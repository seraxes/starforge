import 'server-only'

import Redis from 'ioredis'

/**
 * Shared Redis client for Starforge ports (published-content cache,
 * rate-limit; queues later). One connection per process via globalThis.
 *
 * Secrets stay in env — prefer `REDIS_URL` (DO Managed Redis / local).
 */
type RedisGlobal = typeof globalThis & {
  __starforgeRedis?: Redis
}

export function redisUrlFromEnv(): string {
  return (process.env.REDIS_URL ?? '').trim()
}

/**
 * Lazy singleton. Throws if `REDIS_URL` is missing — callers that select Redis
 * (e.g. `STARFORGE_CONTENT_CACHE=redis`) must set it.
 */
export function getRedisClient(): Redis {
  const url = redisUrlFromEnv()
  if (!url) {
    throw new Error(
      'REDIS_URL is required when using Redis-backed ports. Example: redis://127.0.0.1:6379 (or rediss://… for TLS). Leave STARFORGE_CONTENT_CACHE unset locally to keep the Next.js tag cache.',
    )
  }

  const g = globalThis as RedisGlobal
  if (!g.__starforgeRedis) {
    g.__starforgeRedis = new Redis(url, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      // Fail fast in serverless / misconfig rather than hanging requests.
      connectTimeout: 10_000,
      lazyConnect: false,
    })
  }
  return g.__starforgeRedis
}
