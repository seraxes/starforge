import 'server-only'

import { and, asc, eq } from 'drizzle-orm'

import { db, sfRedirects } from '@/core/db'

import { parseRedirectCsv, type RedirectCsvRowInput } from './csv'
import { normalizeRedirectFromPath, normalizeRedirectToPath } from './paths'
import {
  isRedirectStatusCode,
  type RedirectLookupHit,
  type RedirectRecord,
  type RedirectStatusCode,
} from './types'

function mapRow(row: typeof sfRedirects.$inferSelect): RedirectRecord {
  const statusCode: RedirectStatusCode = isRedirectStatusCode(row.statusCode)
    ? row.statusCode
    : 301
  return {
    id: row.id,
    fromPath: row.fromPath,
    toPath: row.toPath,
    statusCode,
    enabled: Boolean(row.enabled),
    note: row.note?.trim() || '',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function listRedirects(): Promise<RedirectRecord[]> {
  try {
    const rows = await db
      .select()
      .from(sfRedirects)
      .orderBy(asc(sfRedirects.fromPath), asc(sfRedirects.id))
    return rows.map(mapRow)
  } catch {
    return []
  }
}

export async function findRedirectById(id: string): Promise<RedirectRecord | null> {
  const trimmed = id.trim()
  if (!trimmed) return null
  try {
    const [row] = await db
      .select()
      .from(sfRedirects)
      .where(eq(sfRedirects.id, trimmed))
      .limit(1)
    return row ? mapRow(row) : null
  } catch {
    return null
  }
}

export async function findRedirectByFromPath(
  pathname: string,
): Promise<RedirectRecord | null> {
  const fromPath = normalizeRedirectFromPath(pathname)
  if (!fromPath) return null
  try {
    const [row] = await db
      .select()
      .from(sfRedirects)
      .where(eq(sfRedirects.fromPath, fromPath))
      .limit(1)
    return row ? mapRow(row) : null
  } catch {
    return null
  }
}

/**
 * Edge-friendly lookup: enabled redirect whose from_path matches normalized path.
 * Fail-open (null) when the table is missing or the query errors.
 */
export async function lookupEnabledRedirect(
  pathname: string,
): Promise<RedirectLookupHit | null> {
  const fromPath = normalizeRedirectFromPath(pathname)
  if (!fromPath) return null

  try {
    const [row] = await db
      .select({
        toPath: sfRedirects.toPath,
        statusCode: sfRedirects.statusCode,
      })
      .from(sfRedirects)
      .where(and(eq(sfRedirects.fromPath, fromPath), eq(sfRedirects.enabled, true)))
      .limit(1)

    if (!row) return null
    const status: RedirectStatusCode = isRedirectStatusCode(row.statusCode)
      ? row.statusCode
      : 301
    return { to: row.toPath, status }
  } catch {
    return null
  }
}

export type CreateRedirectInput = {
  fromPath: string
  toPath: string
  statusCode?: number
  enabled?: boolean
  note?: string
  id?: string
}

export async function createRedirect(
  input: CreateRedirectInput,
): Promise<{ redirect: RedirectRecord } | { error: string }> {
  const fromPath = normalizeRedirectFromPath(input.fromPath)
  const toPath = normalizeRedirectToPath(input.toPath)
  if (!fromPath) return { error: 'From path is required (e.g. /old-page).' }
  if (!toPath) return { error: 'To path is required (e.g. /new-page or https://…).' }
  if (fromPath === toPath) return { error: 'From and to must be different.' }

  const statusCode: RedirectStatusCode = isRedirectStatusCode(input.statusCode)
    ? input.statusCode
    : 301
  const enabled = input.enabled !== false
  const note = (input.note || '').trim().slice(0, 200)
  const id = (input.id || '').trim() || crypto.randomUUID()

  try {
    const existing = await db
      .select({ id: sfRedirects.id })
      .from(sfRedirects)
      .where(eq(sfRedirects.fromPath, fromPath))
      .limit(1)
    if (existing[0]) {
      return { error: `A redirect from “${fromPath}” already exists.` }
    }

    await db.insert(sfRedirects).values({
      id,
      fromPath,
      toPath,
      statusCode,
      enabled,
      note: note || null,
    })

    const created = await findRedirectById(id)
    if (!created) return { error: 'Redirect created but could not be reloaded.' }
    return { redirect: created }
  } catch (error) {
    if (error instanceof Error && error.message.includes('sf_redirects')) {
      return {
        error: 'sf_redirects table missing — run npm run db:core:push.',
      }
    }
    const msg = error instanceof Error ? error.message : 'Could not create redirect.'
    if (/unique|duplicate/i.test(msg)) {
      return { error: `A redirect from “${fromPath}” already exists.` }
    }
    return { error: msg }
  }
}

export type UpdateRedirectInput = {
  id: string
  fromPath?: string
  toPath?: string
  statusCode?: number
  enabled?: boolean
  note?: string
}

export async function updateRedirect(
  input: UpdateRedirectInput,
): Promise<{ redirect: RedirectRecord } | { error: string }> {
  const id = input.id.trim()
  if (!id) return { error: 'Missing redirect id.' }

  const current = await findRedirectById(id)
  if (!current) return { error: 'Redirect not found.' }

  const fromPath =
    input.fromPath !== undefined
      ? normalizeRedirectFromPath(input.fromPath)
      : current.fromPath
  const toPath =
    input.toPath !== undefined ? normalizeRedirectToPath(input.toPath) : current.toPath
  if (!fromPath) return { error: 'From path is required (e.g. /old-page).' }
  if (!toPath) return { error: 'To path is required (e.g. /new-page or https://…).' }
  if (fromPath === toPath) return { error: 'From and to must be different.' }

  const statusCode: RedirectStatusCode =
    input.statusCode !== undefined && isRedirectStatusCode(input.statusCode)
      ? input.statusCode
      : current.statusCode
  const enabled = input.enabled !== undefined ? Boolean(input.enabled) : current.enabled
  const note =
    input.note !== undefined ? input.note.trim().slice(0, 200) : current.note

  try {
    if (fromPath !== current.fromPath) {
      const clash = await db
        .select({ id: sfRedirects.id })
        .from(sfRedirects)
        .where(eq(sfRedirects.fromPath, fromPath))
        .limit(1)
      if (clash[0] && clash[0].id !== id) {
        return { error: `A redirect from “${fromPath}” already exists.` }
      }
    }

    await db
      .update(sfRedirects)
      .set({
        fromPath,
        toPath,
        statusCode,
        enabled,
        note: note || null,
      })
      .where(eq(sfRedirects.id, id))

    const updated = await findRedirectById(id)
    if (!updated) return { error: 'Redirect updated but could not be reloaded.' }
    return { redirect: updated }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Could not update redirect.'
    if (/unique|duplicate/i.test(msg)) {
      return { error: `A redirect from “${fromPath}” already exists.` }
    }
    return { error: msg }
  }
}

export async function deleteRedirect(
  id: string,
): Promise<{ ok: true } | { error: string }> {
  const trimmed = id.trim()
  if (!trimmed) return { error: 'Missing redirect id.' }
  try {
    await db.delete(sfRedirects).where(eq(sfRedirects.id, trimmed))
    return { ok: true }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Could not delete redirect.',
    }
  }
}

export type ImportRedirectsResult = {
  imported: number
  skipped: number
}

async function upsertRedirectFromCsvRow(
  row: RedirectCsvRowInput,
): Promise<{ ok: true } | { error: string }> {
  const existing = await findRedirectByFromPath(row.fromPath)
  if (existing) {
    const result = await updateRedirect({
      id: existing.id,
      toPath: row.toPath,
      statusCode: row.statusCode,
      enabled: row.enabled,
      note: row.note,
    })
    return 'error' in result ? result : { ok: true }
  }
  const result = await createRedirect({
    fromPath: row.fromPath,
    toPath: row.toPath,
    statusCode: row.statusCode,
    enabled: row.enabled,
    note: row.note,
  })
  return 'error' in result ? result : { ok: true }
}

/**
 * Import redirects from CSV text. Invalid rows are skipped.
 * Matching `fromPath` updates to/status/enabled/note (no duplicate source paths).
 */
export async function importRedirectsFromCsv(
  text: string,
): Promise<ImportRedirectsResult | { error: string }> {
  const parsed = parseRedirectCsv(text)
  if ('error' in parsed) return parsed

  let imported = 0
  let skipped = parsed.skipped

  for (const row of parsed.rows) {
    const result = await upsertRedirectFromCsvRow(row)
    if ('error' in result) {
      skipped++
      continue
    }
    imported++
  }

  return { imported, skipped }
}
