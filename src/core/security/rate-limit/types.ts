/**
 * Shared RateLimiter port (design-security §6).
 * Memory locally; Redis (`INCR` + `EXPIRE`) when `REDIS_URL` is set.
 * Forms uses this today; auth recovery can reuse the same port later.
 */

export type RateLimitConsumeOptions = {
  limit: number
  windowSec: number
}

export type RateLimitResult = {
  ok: boolean
  retryAfterSec?: number
}

export interface RateLimiter {
  consume(key: string, options: RateLimitConsumeOptions): Promise<RateLimitResult>
}
