/**
 * Recurring payment intents — Payments owns gateway ids / cancel.
 * Gateway charge adapters wire later; this table is the durable handle consumers store.
 */

import 'server-only'

import { eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import { db } from '@/core/db'

import { sfPayRecurring } from './schema'

function newId(): string {
  return `prec_${randomUUID().replace(/-/g, '')}`
}

export type RecurringRecord = {
  id: string
  userId: string
  method: string
  status: 'active' | 'canceled'
  providerRef: string
  sourceModule: string
  sourceType: string
  sourceId: string
  metadata: Record<string, unknown>
  nextChargeAt: Date | null
  canceledAt: Date | null
}

function mapRow(row: typeof sfPayRecurring.$inferSelect): RecurringRecord {
  return {
    id: row.id,
    userId: row.userId,
    method: row.method ?? '',
    status: row.status === 'canceled' ? 'canceled' : 'active',
    providerRef: row.providerRef ?? '',
    sourceModule: row.sourceModule ?? '',
    sourceType: row.sourceType ?? '',
    sourceId: row.sourceId ?? '',
    metadata: (row.metadata && typeof row.metadata === 'object' ? row.metadata : {}) as Record<
      string,
      unknown
    >,
    nextChargeAt: row.nextChargeAt ?? null,
    canceledAt: row.canceledAt ?? null,
  }
}

export async function createRecurring(input: {
  userId: string
  method: string
  sourceModule: string
  sourceType: string
  sourceId: string
  metadata?: Record<string, unknown>
  providerRef?: string
  nextChargeAt?: Date | null
}): Promise<{ ok: true; id: string; recurring: RecurringRecord } | { ok: false; error: string }> {
  const userId = input.userId.trim()
  if (!userId) return { ok: false, error: 'userId required.' }
  const id = newId()
  try {
    await db.insert(sfPayRecurring).values({
      id,
      userId,
      method: String(input.method ?? '').trim(),
      status: 'active',
      providerRef: String(input.providerRef ?? '').trim(),
      sourceModule: String(input.sourceModule ?? '').trim(),
      sourceType: String(input.sourceType ?? '').trim(),
      sourceId: String(input.sourceId ?? '').trim(),
      metadata: input.metadata ?? {},
      nextChargeAt: input.nextChargeAt ?? null,
    })
    const rows = await db.select().from(sfPayRecurring).where(eq(sfPayRecurring.id, id)).limit(1)
    if (!rows[0]) return { ok: false, error: 'Recurring create failed.' }
    return { ok: true, id, recurring: mapRow(rows[0]) }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_pay_recurring|does not exist|relation/i.test(msg)) {
      return { ok: false, error: 'sf_pay_recurring missing — run npm run db:migrate.' }
    }
    return { ok: false, error: msg }
  }
}

export async function cancelRecurring(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = id.trim()
  if (!trimmed) return { ok: false, error: 'Missing recurring id.' }
  try {
    const now = new Date()
    await db
      .update(sfPayRecurring)
      .set({ status: 'canceled', canceledAt: now, updatedAt: now })
      .where(eq(sfPayRecurring.id, trimmed))
    // Gateway cancel adapters attach here when a provider_ref is present.
    return { ok: true }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return { ok: false, error: msg }
  }
}

export async function findRecurringById(id: string): Promise<RecurringRecord | null> {
  const trimmed = id.trim()
  if (!trimmed) return null
  try {
    const rows = await db
      .select()
      .from(sfPayRecurring)
      .where(eq(sfPayRecurring.id, trimmed))
      .limit(1)
    return rows[0] ? mapRow(rows[0]) : null
  } catch {
    return null
  }
}
