import 'server-only'

import type { DashboardStatsResult } from '@/core/dashboard'

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

/**
 * Soft stub — later: captcha provider/surfaces, RateLimiter enable, security headers.
 * Unavailable → “—” / Coming soon, not fake posture chips.
 */
export async function loadSecurityPostureStats(): Promise<
  DashboardStatsResult<SecurityPostureStats>
> {
  return {
    ok: false,
    error: 'Security posture glance is not wired yet',
    status: 'unavailable',
  }
}
