import 'server-only'

import { desc, eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import { db, sfFormSubmissions } from '@/core/db'

import type { FormSubmissionPayload, FormSubmissionRecord } from './types'

function normalizePayload(raw: unknown): FormSubmissionPayload {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: FormSubmissionPayload = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v === undefined) continue
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || v === null) {
      out[k] = v
    } else if (Array.isArray(v)) {
      out[k] = v.map((item) => (item == null ? '' : String(item)))
    } else {
      out[k] = String(v)
    }
  }
  return out
}

function mapRow(row: typeof sfFormSubmissions.$inferSelect): FormSubmissionRecord {
  return {
    id: row.id,
    formKey: row.formKey,
    definitionId: row.definitionId ?? null,
    definitionVersion: row.definitionVersion ?? null,
    fieldsSnapshot: row.fieldsSnapshot ?? null,
    userId: row.userId ?? null,
    layoutId: row.layoutId,
    slotId: row.slotId,
    payload: normalizePayload(row.payload),
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    createdAt: row.createdAt,
  }
}

export async function createFormSubmission(input: {
  formKey: string
  definitionId?: string | null
  definitionVersion?: number | null
  fieldsSnapshot?: unknown
  userId?: string | null
  layoutId?: string | null
  slotId?: string | null
  payload: FormSubmissionPayload
  ipAddress?: string | null
  userAgent?: string | null
}): Promise<FormSubmissionRecord> {
  const id = randomUUID()
  const [row] = await db
    .insert(sfFormSubmissions)
    .values({
      id,
      formKey: input.formKey,
      definitionId: input.definitionId ?? null,
      definitionVersion: input.definitionVersion ?? null,
      fieldsSnapshot: input.fieldsSnapshot ?? null,
      userId: input.userId ?? null,
      layoutId: input.layoutId ?? null,
      slotId: input.slotId ?? null,
      payload: input.payload,
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
  definitionId?: string
}): Promise<FormSubmissionRecord[]> {
  const limit = Math.min(Math.max(options?.limit ?? 100, 1), 500)

  if (options?.definitionId) {
    const rows = await db
      .select()
      .from(sfFormSubmissions)
      .where(eq(sfFormSubmissions.definitionId, options.definitionId))
      .orderBy(desc(sfFormSubmissions.createdAt))
      .limit(limit)
    return rows.map(mapRow)
  }

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
