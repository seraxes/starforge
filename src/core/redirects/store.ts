import 'server-only'

import { and, asc, eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import { db, sfRedirects } from '@/core/db'

import {
  normalizeFromPath,
  normalizeStatusCode,
  normalizeToUrl,
} from './normalize'
import type { RedirectMatch, RedirectRecord, RedirectStatusCode } from './types'

function mapRow(row: typeof sfRedirects.$inferSelect): RedirectRecord {
  return {
    id: row.id,
    fromPath: row.fromPath,
    toUrl: row.toUrl,
    statusCode: row.statusCode === 302 ? 302 : 301,
    enabled: row.enabled,
    note: row.note,
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

export async function getRedirectById(id: string): Promise<RedirectRecord | null> {
  const key = (id || '').trim()
  if (!key) return null
  try {
    const [row] = await db.select().from(sfRedirects).where(eq(sfRedirects.id, key)).limit(1)
    return row ? mapRow(row) : null
  } catch {
    return null
  }
}

export async function findEnabledRedirectByFromPath(
  fromPath: string,
): Promise<RedirectMatch | null> {
  const path = normalizeFromPath(fromPath)
  if (!path) return null
  try {
    const [row] = await db
      .select({
        toUrl: sfRedirects.toUrl,
        statusCode: sfRedirects.statusCode,
      })
      .from(sfRedirects)
      .where(and(eq(sfRedirects.fromPath, path), eq(sfRedirects.enabled, true)))
      .limit(1)
    if (!row) return null
    const status: RedirectStatusCode = row.statusCode === 302 ? 302 : 301
    return { to: row.toUrl, status }
  } catch {
    return null
  }
}

export type UpsertRedirectInput = {
  id?: string
  fromPath: string
  toUrl: string
  statusCode?: unknown
  enabled?: boolean
  note?: string | null
}

export type UpsertRedirectResult =
  | { ok: true; record: RedirectRecord }
  | { ok: false; error: string }

export async function upsertRedirect(input: UpsertRedirectInput): Promise<UpsertRedirectResult> {
  const fromPath = normalizeFromPath(input.fromPath)
  if (!fromPath) {
    return {
      ok: false,
      error:
        'From path must be a site path (leading /), not /admin, /api, /app, or auth/SEO endpoints.',
    }
  }
  const toUrl = normalizeToUrl(input.toUrl)
  if (!toUrl) {
    return { ok: false, error: 'To must be a site-relative path or http(s) URL.' }
  }
  if (fromPath === toUrl) {
    return { ok: false, error: 'From and To cannot be the same path.' }
  }

  const statusCode = normalizeStatusCode(input.statusCode)
  const enabled = input.enabled !== false
  const noteRaw = typeof input.note === 'string' ? input.note.trim() : ''
  const note = noteRaw ? noteRaw.slice(0, 500) : null
  const existingId = typeof input.id === 'string' ? input.id.trim() : ''

  try {
    if (existingId) {
      const [updated] = await db
        .update(sfRedirects)
        .set({
          fromPath,
          toUrl,
          statusCode,
          enabled,
          note,
        })
        .where(eq(sfRedirects.id, existingId))
        .returning()
      if (!updated) {
        return { ok: false, error: 'Redirect not found.' }
      }
      return { ok: true, record: mapRow(updated) }
    }

    const id = randomUUID()
    const [created] = await db
      .insert(sfRedirects)
      .values({
        id,
        fromPath,
        toUrl,
        statusCode,
        enabled,
        note,
      })
      .returning()
    if (!created) {
      return { ok: false, error: 'Failed to create redirect.' }
    }
    return { ok: true, record: mapRow(created) }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (/unique|duplicate/i.test(message)) {
      return { ok: false, error: `A redirect from “${fromPath}” already exists.` }
    }
    return { ok: false, error: 'Could not save redirect (is sf_redirects migrated?).' }
  }
}

export async function deleteRedirect(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const key = (id || '').trim()
  if (!key) return { ok: false, error: 'Missing redirect id.' }
  try {
    const deleted = await db.delete(sfRedirects).where(eq(sfRedirects.id, key)).returning({
      id: sfRedirects.id,
    })
    if (!deleted.length) return { ok: false, error: 'Redirect not found.' }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Could not delete redirect.' }
  }
}
