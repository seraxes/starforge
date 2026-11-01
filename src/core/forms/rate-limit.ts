/**
 * Simple in-memory rate limit for form submissions (per process).
 * Redis can replace this later without changing the call sites.
 */

type Bucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

const DEFAULT_WINDOW_MS = 60_000
const DEFAULT_MAX = 8

export type RateLimitResult = {
  ok: boolean
  retryAfterSec?: number
}

/**
 * Sliding fixed-window counter. Key should include IP (and optionally formKey).
 */
export function checkFormRateLimit(
  key: string,
  options?: { windowMs?: number; max?: number },
): RateLimitResult {
  const windowMs = options?.windowMs ?? DEFAULT_WINDOW_MS
  const max = options?.max ?? DEFAULT_MAX
  const now = Date.now()
  const existing = buckets.get(key)

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true }
  }

  if (existing.count >= max) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    }
  }

  existing.count += 1
  return { ok: true }
}

/** Test helper — clear buckets between tests. */
export function clearFormRateLimitBuckets(): void {
  buckets.clear()
}
