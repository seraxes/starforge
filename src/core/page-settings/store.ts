import { eq } from 'drizzle-orm'

import { contentCacheTags, getPublishedContentCache } from '@/core/content/cache'
import { invalidatePageChrome } from '@/core/content/revalidate'
import { db, GLOBAL_PAGE_CHROME_ID, sfPageChrome } from '@/core/db'

import { DEFAULT_GLOBAL_PAGE_CHROME } from './defaults'
import { normalizePageChrome, parsePageChromeJson, serializePageChrome } from './merge'
import { isDocumentChromeRowId, outlineChromeRowId } from './outline-chrome'
import type { PageChrome } from './types'

/** pageKey for normalize — null for global / outline chrome rows. */
function pageKeyForChromeRowId(id: string): string | null {
  return isDocumentChromeRowId(id) ? null : id
}

export type PageChromeLoadSource = 'database' | 'default'

export type PageChromeLoadResult = {
  chrome: PageChrome
  source: PageChromeLoadSource
  isFallback: boolean
}

/**
 * Load one chrome row by id (`global`, `outline:<id>`, or pageKey) — uncached DB/default path.
 * Missing/unreadable → empty chrome (caller merges with defaults).
 * Exported for offline / system screens that must not await published-content cache.
 */
export async function loadPageChromeRowUncached(id: string): Promise<PageChromeLoadResult> {
  const pageKey = pageKeyForChromeRowId(id)
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

/**
 * Load one chrome row by id (`global` or pageKey).
 * Cross-request cache via published-content cache.
 */
export async function loadPageChromeRow(id: string): Promise<PageChromeLoadResult> {
  const rowId = id.trim() || GLOBAL_PAGE_CHROME_ID
  return getPublishedContentCache().getCached(
    {
      key: ['sf', 'page-chrome', rowId],
      tags: [contentCacheTags.pageChrome, contentCacheTags.pageChromeRow(rowId)],
      revalidate: false,
    },
    () => loadPageChromeRowUncached(rowId),
  )
}

export async function loadGlobalPageChrome(): Promise<PageChromeLoadResult> {
  return loadPageChromeRow(GLOBAL_PAGE_CHROME_ID)
}

export async function loadPageChromeOverride(pageKey: string): Promise<PageChromeLoadResult> {
  return loadPageChromeRow(pageKey)
}

/** Load sparse chrome overrides for a non-Base outline (`outline:<id>`). */
export async function loadOutlinePageChrome(outlineId: string): Promise<PageChromeLoadResult> {
  return loadPageChromeRow(outlineChromeRowId(outlineId))
}

/** Upsert chrome JSON for global, outline, or pageKey. */
export async function savePageChrome(id: string, chrome: PageChrome): Promise<PageChrome> {
  const pageKey = pageKeyForChromeRowId(id)
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

  await invalidatePageChrome(id)
  return normalized
}

/** List nav pageKey chrome rows (excludes `global` and `outline:*`). */
export async function listPageChromeOverrideKeys(): Promise<string[]> {
  try {
    const rows = await db.select({ id: sfPageChrome.id }).from(sfPageChrome)
    return rows.map((r) => r.id).filter((id) => !isDocumentChromeRowId(id))
  } catch {
    return []
  }
}

/** Delete a pageKey or outline chrome row (no-op for global). */
export async function deletePageChromeOverride(pageKey: string): Promise<boolean> {
  if (!pageKey || pageKey === GLOBAL_PAGE_CHROME_ID) return false
  try {
    await db.delete(sfPageChrome).where(eq(sfPageChrome.id, pageKey))
    await invalidatePageChrome(pageKey)
    return true
  } catch {
    return false
  }
}

/** Delete outline-scoped chrome when an outline is removed. */
export async function deleteOutlinePageChrome(outlineId: string): Promise<boolean> {
  const id = outlineId.trim()
  if (!id) return false
  return deletePageChromeOverride(outlineChromeRowId(id))
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
