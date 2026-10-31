import { eq } from 'drizzle-orm'

import { db, GLOBAL_PAGE_CHROME_ID, sfPageChrome } from '@/core/db'

import { DEFAULT_GLOBAL_PAGE_CHROME } from './defaults'
import { normalizePageChrome, parsePageChromeJson, serializePageChrome } from './merge'
import type { PageChrome } from './types'

export type PageChromeLoadSource = 'database' | 'default'

export type PageChromeLoadResult = {
  chrome: PageChrome
  source: PageChromeLoadSource
  isFallback: boolean
}

/**
 * Load one chrome row by id (`global` or pageKey).
 * Missing/unreadable → empty chrome (caller merges with defaults).
 */
export async function loadPageChromeRow(id: string): Promise<PageChromeLoadResult> {
  const pageKey = id === GLOBAL_PAGE_CHROME_ID ? null : id
  try {
    const [row] = await db
      .select({ document: sfPageChrome.document })
      .from(sfPageChrome)
      .where(eq(sfPageChrome.id, id))
      .limit(1)

    if (row?.document?.trim()) {
      const parsed = parsePageChromeJson(row.document, pageKey)
      if (parsed) {
        return { chrome: parsed, source: 'database', isFallback: false }
      }
    }
  } catch {
    // Table may not exist yet — fall through.
  }

  if (id === GLOBAL_PAGE_CHROME_ID) {
    return {
      chrome: { ...DEFAULT_GLOBAL_PAGE_CHROME },
      source: 'default',
      isFallback: true,
    }
  }

  return {
    chrome: normalizePageChrome({}, pageKey),
    source: 'default',
    isFallback: true,
  }
}

export async function loadGlobalPageChrome(): Promise<PageChromeLoadResult> {
  return loadPageChromeRow(GLOBAL_PAGE_CHROME_ID)
}

export async function loadPageChromeOverride(pageKey: string): Promise<PageChromeLoadResult> {
  return loadPageChromeRow(pageKey)
}

/** Upsert chrome JSON for global or a pageKey. */
export async function savePageChrome(id: string, chrome: PageChrome): Promise<PageChrome> {
  const pageKey = id === GLOBAL_PAGE_CHROME_ID ? null : id
  const normalized = normalizePageChrome(
    {
      ...chrome,
      pageKey,
    },
    pageKey,
  )
  const json = serializePageChrome(normalized)
  const now = new Date()

  const [existing] = await db
    .select({ id: sfPageChrome.id })
    .from(sfPageChrome)
    .where(eq(sfPageChrome.id, id))
    .limit(1)

  if (existing) {
    await db
      .update(sfPageChrome)
      .set({ document: json, updatedAt: now })
      .where(eq(sfPageChrome.id, id))
  } else {
    await db.insert(sfPageChrome).values({
      id,
      document: json,
      createdAt: now,
      updatedAt: now,
    })
  }

  return normalized
}

/** List pageKeys that have an override row (excludes global). */
export async function listPageChromeOverrideKeys(): Promise<string[]> {
  try {
    const rows = await db.select({ id: sfPageChrome.id }).from(sfPageChrome)
    return rows.map((r) => r.id).filter((id) => id !== GLOBAL_PAGE_CHROME_ID)
  } catch {
    return []
  }
}

/** Delete a per-page override (no-op for global). */
export async function deletePageChromeOverride(pageKey: string): Promise<boolean> {
  if (!pageKey || pageKey === GLOBAL_PAGE_CHROME_ID) return false
  try {
    await db.delete(sfPageChrome).where(eq(sfPageChrome.id, pageKey))
    return true
  } catch {
    return false
  }
}

/**
 * Seed helper: write global defaults when no row exists.
 */
export async function ensureGlobalPageChromeSeeded(): Promise<{
  created: boolean
  chrome: PageChrome
}> {
  try {
    const [row] = await db
      .select({ id: sfPageChrome.id, document: sfPageChrome.document })
      .from(sfPageChrome)
      .where(eq(sfPageChrome.id, GLOBAL_PAGE_CHROME_ID))
      .limit(1)

    if (row?.document?.trim()) {
      const parsed = parsePageChromeJson(row.document, null)
      if (parsed) {
        return { created: false, chrome: parsed }
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('sf_page_chrome')) throw error
    throw new Error(
      'sf_page_chrome table missing — run npm run db:core:push before seeding page settings.',
    )
  }

  const chrome = await savePageChrome(GLOBAL_PAGE_CHROME_ID, { ...DEFAULT_GLOBAL_PAGE_CHROME })
  return { created: true, chrome }
}
