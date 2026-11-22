/**
 * Social member-write bucket via the shared RateLimiter port (memory / Redis).
 * Defaults are code constants; pack settings may override limit / window.
 * Key: `social-write:${userId}:${clientIp(headers)}`.
 *
 * Do not add a second limiter. Member media upload already consumes
 * `member-media:*` in its own request — do not double-consume here when that
 * path already ran in the same request.
 */

import { clientIp } from '@/core/security/client-ip'
import {
  clearMemoryRateLimitBuckets,
  getRateLimiter,
  type RateLimitResult,
} from '@/core/security/rate-limit'

import {
  DEFAULT_SOCIAL_MODULE_SETTINGS,
  SOCIAL_WRITE_RATE_LIMIT_MAX_DEFAULT,
  SOCIAL_WRITE_RATE_LIMIT_WINDOW_SEC_DEFAULT,
} from './pack-settings'

export type { RateLimitResult }

export const SOCIAL_WRITE_RATE_LIMITED_MESSAGE =
  'Too many actions — wait a moment and try again.'

/**
 * Consume one Social member-write token for this user + client IP.
 * Pass `limit` / `windowSec` to skip the pack-settings load (tests).
 */
export async function checkSocialWriteRateLimit(
  userId: string,
  requestHeaders: Headers,
  options?: { limit?: number; windowSec?: number },
): Promise<RateLimitResult> {
  let limit = options?.limit ?? SOCIAL_WRITE_RATE_LIMIT_MAX_DEFAULT
  let windowSec = options?.windowSec ?? SOCIAL_WRITE_RATE_LIMIT_WINDOW_SEC_DEFAULT

  if (options?.limit == null || options?.windowSec == null) {
    try {
      const { loadSocialModuleSettings } = await import('./settings')
      const pack = await loadSocialModuleSettings()
      if (options?.limit == null) {
        limit = pack.settings.writeRateLimitMax
      }
      if (options?.windowSec == null) {
        windowSec = pack.settings.writeRateLimitWindowSec
      }
    } catch {
      // Settings unavailable — keep code defaults / explicit options.
      if (options?.limit == null) {
        limit = DEFAULT_SOCIAL_MODULE_SETTINGS.writeRateLimitMax
      }
      if (options?.windowSec == null) {
        windowSec = DEFAULT_SOCIAL_MODULE_SETTINGS.writeRateLimitWindowSec
      }
    }
  }

  const uid = userId.trim() || 'anonymous'
  const ip = clientIp(requestHeaders)
  return getRateLimiter().consume(`social-write:${uid}:${ip}`, { limit, windowSec })
}

/** Test helper — clear in-memory buckets between tests. */
export function clearSocialWriteRateLimitBuckets(): void {
  clearMemoryRateLimitBuckets()
}
