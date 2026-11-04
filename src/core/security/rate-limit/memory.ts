import type { RateLimitConsumeOptions, RateLimitResult, RateLimiter } from './types'

type Bucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

/** Test helper — clear in-memory buckets between tests. */
export function clearMemoryRateLimitBuckets(): void {
  buckets.clear()
}

export function createMemoryRateLimiter(): RateLimiter {
  return {
    async consume(key, options: RateLimitConsumeOptions): Promise<RateLimitResult> {
      const windowMs = Math.max(1, options.windowSec) * 1000
      const limit = Math.max(1, options.limit)
      const now = Date.now()
      const existing = buckets.get(key)

      if (!existing || existing.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + windowMs })
        return { ok: true }
      }

      if (existing.count >= limit) {
        return {
          ok: false,
          retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
        }
      }

      existing.count += 1
      return { ok: true }
    },
  }
}
