import 'server-only'

import type { DashboardStatsResult } from '@/core/dashboard'

/** At-a-glance Email volume buckets (count + type). */
export const EMAIL_DASHBOARD_TYPES = [
  { key: 'total', label: 'Sent (all)' },
  { key: 'transactional', label: 'Transactional' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'system', label: 'System' },
] as const

export type EmailTypeKey = (typeof EMAIL_DASHBOARD_TYPES)[number]['key']

export type EmailSentStats = {
  byType: Record<EmailTypeKey, number | null>
}

/**
 * Soft stub — D3 needs a durable send log (`sf_email_sends` or Mailer audit).
 * Unavailable → card shows “—” / Coming soon, not empty junk.
 */
export async function loadEmailSentStats(): Promise<DashboardStatsResult<EmailSentStats>> {
  return {
    ok: false,
    error: 'Email send log is not wired yet',
    status: 'unavailable',
  }
}
