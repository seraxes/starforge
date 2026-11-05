/**
 * Recent Email Manager send-log rows for admin UI.
 * Soft-fails when `sf_email_sends` / DB is unreachable.
 */

import 'server-only'

import { desc } from 'drizzle-orm'

import { isEmailSendType, type EmailSendType } from './send-type'
import type { EmailSendStatus } from './send-log'
import { sfEmailSends } from './schema'

export type EmailSendListRow = {
  id: string
  createdAt: Date
  toAddress: string
  emailType: EmailSendType
  status: EmailSendStatus
  /** Display title — prefers title, falls back to subject. */
  title: string
  subject: string
  error: string | null
}

export type ListRecentEmailSendsResult = {
  rows: EmailSendListRow[]
  /** Query failed (missing table / pool) — UI should soft-empty, not crash. */
  unavailable: boolean
}

const STATUSES: readonly EmailSendStatus[] = ['sent', 'failed', 'skipped']

function isEmailSendStatus(value: unknown): value is EmailSendStatus {
  return typeof value === 'string' && (STATUSES as readonly string[]).includes(value)
}

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

/**
 * Newest-first send log for Email → Sends.
 */
export async function listRecentEmailSends(options?: {
  limit?: number
}): Promise<ListRecentEmailSendsResult> {
  const limit = Math.min(
    Math.max(1, Math.floor(options?.limit ?? DEFAULT_LIMIT)),
    MAX_LIMIT,
  )

  try {
    const { db } = await import('@/core/db')
    const rows = await db
      .select({
        id: sfEmailSends.id,
        createdAt: sfEmailSends.createdAt,
        toAddress: sfEmailSends.toAddress,
        emailType: sfEmailSends.emailType,
        status: sfEmailSends.status,
        title: sfEmailSends.title,
        subject: sfEmailSends.subject,
        error: sfEmailSends.error,
      })
      .from(sfEmailSends)
      .orderBy(desc(sfEmailSends.createdAt), desc(sfEmailSends.id))
      .limit(limit)

    return {
      unavailable: false,
      rows: rows.map((row) => {
        const subject = (row.subject || '').trim()
        const titleRaw = (row.title || '').trim()
        return {
          id: row.id,
          createdAt: row.createdAt,
          toAddress: (row.toAddress || '').trim() || '—',
          emailType: isEmailSendType(row.emailType) ? row.emailType : 'transactional',
          status: isEmailSendStatus(row.status) ? row.status : 'failed',
          title: titleRaw || subject || '—',
          subject,
          error: (row.error || '').trim() || null,
        }
      }),
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '[email-sends] list failed',
        error instanceof Error ? error.message : error,
      )
    }
    return { rows: [], unavailable: true }
  }
}
