import {
  clearMemoryRateLimitBuckets,
  getRateLimiter,
  type RateLimitResult,
} from '@/core/security/rate-limit'
import {
  DEFAULT_FORM_RATE_LIMIT_MAX,
  DEFAULT_FORM_RATE_LIMIT_WINDOW_SEC,
  getSiteSettings,
} from '@/core/settings'

export type { RateLimitResult }

/**
 * Form submit bucket via the shared RateLimiter port (memory / Redis).
 * Defaults come from Site Settings → Performance (DB); code constants are
 * fallbacks only. Key should include IP (and optionally formKey):
 * `form:${ip}:${formKey}`.
 *
 * Redis URL / trusted proxy hops stay in env (Environment) — not here.
 */
export async function checkFormRateLimit(
  key: string,
  options?: { windowMs?: number; windowSec?: number; max?: number },
): Promise<RateLimitResult> {
  let defaultMax = DEFAULT_FORM_RATE_LIMIT_MAX
  let defaultWindowSec = DEFAULT_FORM_RATE_LIMIT_WINDOW_SEC
  if (options?.max == null || (options.windowSec == null && options.windowMs == null)) {
    try {
      const settings = await getSiteSettings()
      defaultMax = settings.formRateLimitMax
      defaultWindowSec = settings.formRateLimitWindowSec
    } catch {
      // Payload/settings unavailable — keep code defaults.
    }
  }

  const windowSec =
    options?.windowSec ??
    (options?.windowMs != null ? Math.max(1, Math.ceil(options.windowMs / 1000)) : defaultWindowSec)
  const limit = options?.max ?? defaultMax
  return getRateLimiter().consume(key, { limit, windowSec })
}

/** Test helper — clear in-memory buckets between tests. */
export function clearFormRateLimitBuckets(): void {
  clearMemoryRateLimitBuckets()
}
