import 'server-only'

import type { DashboardStatsResult } from '@/core/dashboard'

import {
  formatCaptchaPosture,
  formatHeadersPosture,
  formatRateLimitPosture,
} from './security-posture'

/** Soft Security posture buckets for the Dashboard glance card. */
export const SECURITY_DASHBOARD_ROWS = [
  { key: 'captcha', label: 'Captcha' },
  { key: 'rateLimit', label: 'Rate limit' },
  { key: 'headers', label: 'Headers' },
] as const

export type SecurityPostureKey = (typeof SECURITY_DASHBOARD_ROWS)[number]['key']

export type SecurityPostureStats = {
  byKey: Record<SecurityPostureKey, string | null>
}

export {
  formatCaptchaPosture,
  formatHeadersPosture,
  formatRateLimitPosture,
} from './security-posture'

/**
 * Real Security posture for `security.posture`.
 * Captcha from Site Chrome; rate-limit + headers are always-on Core posture
 * (matches Settings → Security copy). Soft-fails if Chrome cannot load.
 */
export async function loadSecurityPostureStats(): Promise<
  DashboardStatsResult<SecurityPostureStats>
> {
  try {
    const { getSiteChrome } = await import('@/core/site-chrome')
    const chrome = await getSiteChrome()

    return {
      ok: true,
      data: {
        byKey: {
          captcha: formatCaptchaPosture(chrome.captchaEnabled, chrome.captchaProvider),
          rateLimit: formatRateLimitPosture(),
          headers: formatHeadersPosture(),
        },
      },
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Security posture glance failed'
    console.error('[dashboard] security.posture stats failed', error)
    return {
      ok: false,
      error: message,
      status: 'error',
    }
  }
}
