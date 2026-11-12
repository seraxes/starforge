/**
 * Paced broadcast persistence — sf_email_broadcasts + recipients.
 */

import 'server-only'

import { and, asc, desc, eq, inArray, lte, sql } from 'drizzle-orm'

import { db } from '@/core/db'

import { sfEmailBroadcastRecipients, sfEmailBroadcasts } from './schema'
import {
  isEmailBroadcastRecipientStatus,
  isEmailBroadcastStatus,
  isEmailModuleCategory,
  type EmailBroadcastRecord,
  type EmailBroadcastRecipientStatus,
  type EmailBroadcastStatus,
  type EmailModuleCategory,
} from './types'

function tableMissingMessage(error: unknown, table: string): string | null {
  const msg = error instanceof Error ? error.message : String(error)
  if (msg.includes(table) || /does not exist|relation/i.test(msg)) {
    return `${table} missing — run npm run db:migrate (or db:core:push).`
  }
  return null
}

function mapBroadcast(row: typeof sfEmailBroadcasts.$inferSelect): EmailBroadcastRecord {
  return {
    id: row.id,
    label: row.label?.trim() || 'Untitled broadcast',
    templateId: row.templateId,
    moduleCategory: isEmailModuleCategory(row.moduleCategory)
      ? row.moduleCategory
      : 'other',
    sourceKey: row.sourceKey?.trim() || '',
    status: isEmailBroadcastStatus(row.status) ? row.status : 'queued',
    batchSize: row.batchSize,
    gapMinutes: row.gapMinutes,
    totalCount: row.totalCount,
    sentCount: row.sentCount,
    failedCount: row.failedCount,
    skippedCount: row.skippedCount,
    nextRunAt: row.nextRunAt ?? null,
    lastError: row.lastError?.trim() || '',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function listEmailBroadcasts(options?: {
  limit?: number
}): Promise<{ rows: EmailBroadcastRecord[]; unavailable: boolean; error?: string }> {
  const limit = Math.min(100, Math.max(1, Math.floor(options?.limit ?? 40)))
  try {
    const rows = await db
      .select()
      .from(sfEmailBroadcasts)
      .orderBy(desc(sfEmailBroadcasts.createdAt))
      .limit(limit)
    return { rows: rows.map(mapBroadcast), unavailable: false }
  } catch (error) {
    const missing = tableMissingMessage(error, 'sf_email_broadcasts')
    return {
      rows: [],
      unavailable: true,
      error: missing || (error instanceof Error ? error.message : 'List failed.'),
    }
  }
}

export async function findEmailBroadcastById(
  id: string,
): Promise<EmailBroadcastRecord | null> {
  const trimmed = id.trim()
  if (!trimmed) return null
  try {
    const [row] = await db
      .select()
      .from(sfEmailBroadcasts)
      .where(eq(sfEmailBroadcasts.id, trimmed))
      .limit(1)
    return row ? mapBroadcast(row) : null
  } catch {
    return null
  }
}

export async function findInFlightBroadcastBySourceKey(
  sourceKey: string,
): Promise<EmailBroadcastRecord | null> {
  const key = sourceKey.trim()
  if (!key) return null
  try {
    const rows = await db
      .select()
      .from(sfEmailBroadcasts)
      .where(
        and(
          eq(sfEmailBroadcasts.sourceKey, key),
          inArray(sfEmailBroadcasts.status, ['queued', 'running']),
        ),
      )
      .orderBy(desc(sfEmailBroadcasts.createdAt))
      .limit(1)
    return rows[0] ? mapBroadcast(rows[0]) : null
  } catch {
    return null
  }
}

export type CreateBroadcastRowInput = {
  id: string
  label: string
  templateId: string
  moduleCategory: EmailModuleCategory
  sourceKey: string
  batchSize: number
  gapMinutes: number
  totalCount: number
  fromOverride?: string
  recipients: Array<{
    id: string
    email: string
    payload: Record<string, unknown>
    sortOrder: number
  }>
}

export async function createBroadcastWithRecipients(
  input: CreateBroadcastRowInput,
): Promise<{ ok: true; broadcast: EmailBroadcastRecord } | { ok: false; error: string }> {
  try {
    await db.insert(sfEmailBroadcasts).values({
      id: input.id,
      label: input.label,
      templateId: input.templateId,
      moduleCategory: input.moduleCategory,
      sourceKey: input.sourceKey,
      status: 'queued',
      batchSize: input.batchSize,
      gapMinutes: input.gapMinutes,
      totalCount: input.totalCount,
      sentCount: 0,
      failedCount: 0,
      skippedCount: 0,
      nextRunAt: new Date(),
      fromOverride: input.fromOverride?.trim() || null,
    })
    if (input.recipients.length) {
      await db.insert(sfEmailBroadcastRecipients).values(
        input.recipients.map((r) => ({
          id: r.id,
          broadcastId: input.id,
          email: r.email,
          status: 'queued',
          payload: r.payload,
          sortOrder: r.sortOrder,
        })),
      )
    }
    const created = await findEmailBroadcastById(input.id)
    if (!created) return { ok: false, error: 'Broadcast created but could not be reloaded.' }
    return { ok: true, broadcast: created }
  } catch (error) {
    const missing =
      tableMissingMessage(error, 'sf_email_broadcasts') ||
      tableMissingMessage(error, 'sf_email_broadcast_recipients')
    return {
      ok: false,
      error: missing || (error instanceof Error ? error.message : 'Create failed.'),
    }
  }
}

export async function updateBroadcastStatus(
  id: string,
  patch: {
    status?: EmailBroadcastStatus
    nextRunAt?: Date | null
    lastError?: string | null
    sentCount?: number
    failedCount?: number
    skippedCount?: number
  },
): Promise<void> {
  const trimmed = id.trim()
  if (!trimmed) return
  try {
    await db
      .update(sfEmailBroadcasts)
      .set({
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.nextRunAt !== undefined ? { nextRunAt: patch.nextRunAt } : {}),
        ...(patch.lastError !== undefined ? { lastError: patch.lastError } : {}),
        ...(patch.sentCount !== undefined ? { sentCount: patch.sentCount } : {}),
        ...(patch.failedCount !== undefined ? { failedCount: patch.failedCount } : {}),
        ...(patch.skippedCount !== undefined ? { skippedCount: patch.skippedCount } : {}),
        updatedAt: new Date(),
      })
      .where(eq(sfEmailBroadcasts.id, trimmed))
  } catch {
    // Soft-fail for drain path.
  }
}

export async function listQueuedRecipients(
  broadcastId: string,
  limit: number,
): Promise<
  Array<{
    id: string
    email: string
    payload: Record<string, unknown>
  }>
> {
  const id = broadcastId.trim()
  const take = Math.max(1, Math.floor(limit))
  if (!id) return []
  try {
    const candidates = await db
      .select({ id: sfEmailBroadcastRecipients.id })
      .from(sfEmailBroadcastRecipients)
      .where(
        and(
          eq(sfEmailBroadcastRecipients.broadcastId, id),
          eq(sfEmailBroadcastRecipients.status, 'queued'),
        ),
      )
      .orderBy(
        asc(sfEmailBroadcastRecipients.sortOrder),
        asc(sfEmailBroadcastRecipients.createdAt),
      )
      .limit(take)

    const out: Array<{
      id: string
      email: string
      payload: Record<string, unknown>
    }> = []
    // Claim each row queued → sending so overlapping drains cannot double-send.
    for (const candidate of candidates) {
      const claimed = await db
        .update(sfEmailBroadcastRecipients)
        .set({ status: 'sending' })
        .where(
          and(
            eq(sfEmailBroadcastRecipients.id, candidate.id),
            eq(sfEmailBroadcastRecipients.status, 'queued'),
          ),
        )
        .returning()
      const row = claimed[0]
      if (!row) continue
      out.push({
        id: row.id,
        email: row.email,
        payload:
          row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload)
            ? (row.payload as Record<string, unknown>)
            : {},
      })
    }
    return out
  } catch {
    return []
  }
}

export async function markRecipientStatus(
  recipientId: string,
  status: EmailBroadcastRecipientStatus,
  error?: string | null,
): Promise<void> {
  const id = recipientId.trim()
  if (!id || !isEmailBroadcastRecipientStatus(status)) return
  try {
    await db
      .update(sfEmailBroadcastRecipients)
      .set({
        status,
        error: error?.trim().slice(0, 1000) || null,
        sentAt: status === 'sent' || status === 'skipped' ? new Date() : null,
      })
      .where(eq(sfEmailBroadcastRecipients.id, id))
  } catch {
    // Soft-fail.
  }
}

export async function countQueuedRecipients(broadcastId: string): Promise<number> {
  const id = broadcastId.trim()
  if (!id) return 0
  try {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(sfEmailBroadcastRecipients)
      .where(
        and(
          eq(sfEmailBroadcastRecipients.broadcastId, id),
          eq(sfEmailBroadcastRecipients.status, 'queued'),
        ),
      )
    return typeof row?.n === 'number' ? row.n : Number(row?.n) || 0
  } catch {
    return 0
  }
}

/** Broadcasts that should drain now (queued/running with due nextRunAt). */
export async function listDueBroadcasts(limit = 20): Promise<EmailBroadcastRecord[]> {
  const take = Math.min(50, Math.max(1, Math.floor(limit)))
  try {
    const now = new Date()
    const rows = await db
      .select()
      .from(sfEmailBroadcasts)
      .where(
        and(
          inArray(sfEmailBroadcasts.status, ['queued', 'running']),
          lte(sfEmailBroadcasts.nextRunAt, now),
        ),
      )
      .orderBy(asc(sfEmailBroadcasts.nextRunAt))
      .limit(take)
    return rows.map(mapBroadcast)
  } catch {
    return []
  }
}

export async function getBroadcastFromOverride(id: string): Promise<string> {
  const trimmed = id.trim()
  if (!trimmed) return ''
  try {
    const [row] = await db
      .select({ fromOverride: sfEmailBroadcasts.fromOverride })
      .from(sfEmailBroadcasts)
      .where(eq(sfEmailBroadcasts.id, trimmed))
      .limit(1)
    return row?.fromOverride?.trim() || ''
  } catch {
    return ''
  }
}
