import 'server-only'

import { desc, eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import { db, sfFormSubmissions } from '@/core/db'

import type { FormSubmissionRecord } from './types'

function parsePayload(raw: string): Record<string, string> {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'string') out[k] = v
      else if (v == null) out[k] = ''
      else out[k] = String(v)
    }
    return out
  } catch {
    return {}
  }
}

function mapRow(row: typeof sfFormSubmissions.$inferSelect): FormSubmissionRecord {
  return {
    id: row.id,
    formKey: row.formKey,
    layoutId: row.layoutId,
    slotId: row.slotId,
    payload: parsePayload(row.payload),
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    createdAt: row.createdAt,
  }
}

export async function createFormSubmission(input: {
  formKey: string
  layoutId?: string | null
  slotId?: string | null
  payload: Record<string, string>
  ipAddress?: string | null
  userAgent?: string | null
}): Promise<FormSubmissionRecord> {
  const id = randomUUID()
  const [row] = await db
    .insert(sfFormSubmissions)
    .values({
      id,
      formKey: input.formKey,
      layoutId: input.layoutId ?? null,
      slotId: input.slotId ?? null,
      payload: JSON.stringify(input.payload),
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    })
    .returning()

  if (!row) {
    throw new Error('Failed to store form submission.')
  }
  return mapRow(row)
}

export async function listFormSubmissions(options?: {
  limit?: number
  formKey?: string
}): Promise<FormSubmissionRecord[]> {
  const limit = Math.min(Math.max(options?.limit ?? 100, 1), 500)

  if (options?.formKey) {
    const rows = await db
      .select()
      .from(sfFormSubmissions)
      .where(eq(sfFormSubmissions.formKey, options.formKey))
      .orderBy(desc(sfFormSubmissions.createdAt))
      .limit(limit)
    return rows.map(mapRow)
  }

  const rows = await db
    .select()
    .from(sfFormSubmissions)
    .orderBy(desc(sfFormSubmissions.createdAt))
    .limit(limit)
  return rows.map(mapRow)
}

export async function countFormSubmissions(): Promise<number> {
  const rows = await db.select({ id: sfFormSubmissions.id }).from(sfFormSubmissions)
  return rows.length
}
