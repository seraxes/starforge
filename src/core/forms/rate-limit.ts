import {
  clearMemoryRateLimitBuckets,
  getRateLimiter,
  type RateLimitResult,
} from '@/core/security/rate-limit'

const DEFAULT_WINDOW_SEC = 60
const DEFAULT_MAX = 8

export type { RateLimitResult }

/**
 * Form submit bucket via the shared RateLimiter port (memory / Redis).
 * Key should include IP (and optionally formKey): `form:${ip}:${formKey}`.
 */
export async function checkFormRateLimit(
  key: string,
  options?: { windowMs?: number; windowSec?: number; max?: number },
): Promise<RateLimitResult> {
  const windowSec =
    options?.windowSec ??
    (options?.windowMs != null ? Math.max(1, Math.ceil(options.windowMs / 1000)) : DEFAULT_WINDOW_SEC)
  const limit = options?.max ?? DEFAULT_MAX
  return getRateLimiter().consume(key, { limit, windowSec })
}

/** Test helper — clear in-memory buckets between tests. */
export function clearFormRateLimitBuckets(): void {
  clearMemoryRateLimitBuckets()
}
