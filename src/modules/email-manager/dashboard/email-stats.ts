import 'server-only'

import type { DashboardStatsResult } from '@/core/dashboard'

import { EMAIL_SEND_TYPES, type EmailSendType } from '../send-type'

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

function emptyByType(): Record<EmailTypeKey, number> {
  return {
    total: 0,
    transactional: 0,
    marketing: 0,
    system: 0,
  }
}

/**
 * Real `sf_email_sends` aggregates for `email.sent`.
 * Counts successful sends (`status = sent`) by email_type.
 * Soft-fails when the DB / table is unreachable.
 */
export async function loadEmailSentStats(): Promise<DashboardStatsResult<EmailSentStats>> {
  try {
    // Dynamic import keeps pure helpers / unit tests free of the pg pool.
    const { sql } = await import('drizzle-orm')
    const { db } = await import('@/core/db')
    const { sfEmailSends } = await import('../schema')

    const rows = await db
      .select({
        emailType: sfEmailSends.emailType,
        n: sql<number>`count(*)::int`,
      })
      .from(sfEmailSends)
      .where(sql`${sfEmailSends.status} = 'sent'`)
      .groupBy(sfEmailSends.emailType)

    const byType = emptyByType()
    for (const row of rows) {
      const key = row.emailType as EmailSendType
      const n = Number(row.n) || 0
      if ((EMAIL_SEND_TYPES as readonly string[]).includes(key)) {
        byType[key] = n
        byType.total += n
      } else {
        // Unknown types still roll into total (and transactional as a safe bucket).
        byType.transactional += n
        byType.total += n
      }
    }

    return {
      ok: true,
      data: { byType },
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Email send log dashboard query failed'
    console.error('[dashboard] email.sent stats failed', error)
    return {
      ok: false,
      error: message,
      status: 'error',
    }
  }
}
