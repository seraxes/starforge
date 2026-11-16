/**
 * Page categories — editorial labels (one per page). Distinct from page tags.
 */

import 'server-only'

import { and, asc, eq, ne, sql } from 'drizzle-orm'

import { db } from '@/core/db'

import { sfPages, sfPagesCategories } from './schema'
import { normalizePageCategorySlug } from './slug'
import type { PageCategoryRecord } from './types'

export type UpsertPageCategoryInput = {
  id?: string
  title: string
  slug?: string
  description?: string
  sortOrder?: unknown
}

function mapCategory(row: typeof sfPagesCategories.$inferSelect): PageCategoryRecord {
  return {
    id: row.id,
    title: row.title?.trim() || 'Untitled category',
    slug: (row.slug || '').trim(),
    description: (row.description || '').trim(),
    sortOrder:
      typeof row.sortOrder === 'number' && Number.isFinite(row.sortOrder)
        ? Math.trunc(row.sortOrder)
        : 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function parseSortOrder(raw: unknown, fallback: number): number {
  if (raw == null || raw === '') return fallback
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim())
  if (!Number.isFinite(n)) return fallback
  return Math.max(-10000, Math.min(10000, Math.trunc(n)))
}

function tableMissingMessage(error: unknown): string | null {
  const msg = error instanceof Error ? error.message : String(error)
  if (/sf_pages_categories/i.test(msg) && /does not exist|relation/i.test(msg)) {
    return 'sf_pages_categories missing — run npm run db:migrate.'
  }
  if (/sf_pages/i.test(msg) && /does not exist|relation/i.test(msg)) {
    return 'sf_pages missing — run npm run db:migrate.'
  }
  return null
}

async function uniqueSlug(base: string, exceptId?: string): Promise<string> {
  const root = base || 'category'
  let slug = root
  for (let n = 2; n < 60; n += 1) {
    const [existing] = await db
      .select({ id: sfPagesCategories.id })
      .from(sfPagesCategories)
      .where(
        exceptId
          ? and(eq(sfPagesCategories.slug, slug), ne(sfPagesCategories.id, exceptId))
          : eq(sfPagesCategories.slug, slug),
      )
      .limit(1)
    if (!existing) return slug
    slug = `${root}-${n}`.slice(0, 120)
  }
  return `${root}-${crypto.randomUUID().slice(0, 8)}`.slice(0, 120)
}

export async function findPageCategoryById(
  id: string,
): Promise<PageCategoryRecord | null> {
  const trimmed = id.trim()
  if (!trimmed) return null
  try {
    const [row] = await db
      .select()
      .from(sfPagesCategories)
      .where(eq(sfPagesCategories.id, trimmed))
      .limit(1)
    return row ? mapCategory(row) : null
  } catch (error) {
    const missing = tableMissingMessage(error)
    if (missing) return null
    throw error
  }
}

export async function listPageCategories(): Promise<
  Array<PageCategoryRecord & { pageCount: number }>
> {
  try {
    const categories = await db
      .select()
      .from(sfPagesCategories)
      .orderBy(asc(sfPagesCategories.sortOrder), asc(sfPagesCategories.title))
    const counts = await db
      .select({
        categoryId: sfPages.categoryId,
        pageCount: sql<number>`count(*)::int`,
      })
      .from(sfPages)
      .groupBy(sfPages.categoryId)
    const byCategory = new Map(
      counts
        .filter((row) => row.categoryId)
        .map((row) => [row.categoryId as string, row.pageCount]),
    )
    return categories.map((row) => ({
      ...mapCategory(row),
      pageCount: byCategory.get(row.id) ?? 0,
    }))
  } catch (error) {
    const missing = tableMissingMessage(error)
    if (missing) throw new Error(missing)
    throw error
  }
}

export async function createPageCategory(
  input: UpsertPageCategoryInput,
): Promise<{ category: PageCategoryRecord } | { error: string }> {
  const title = String(input.title ?? '').trim().slice(0, 120) || 'Untitled category'
  const fromSlug = normalizePageCategorySlug(String(input.slug ?? ''))
  const fromTitle = normalizePageCategorySlug(title)
  const base = fromSlug || fromTitle
  if (!base) return { error: 'Enter a category title or slug.' }
  try {
    const slug = await uniqueSlug(base)
    const id = crypto.randomUUID()
    const [row] = await db
      .insert(sfPagesCategories)
      .values({
        id,
        title,
        slug,
        description: String(input.description ?? '').trim().slice(0, 2000),
        sortOrder: parseSortOrder(input.sortOrder, 0),
      })
      .returning()
    if (!row) return { error: 'Category could not be saved.' }
    return { category: mapCategory(row) }
  } catch (error) {
    const missing = tableMissingMessage(error)
    if (missing) return { error: missing }
    return { error: error instanceof Error ? error.message : 'Could not save category.' }
  }
}

export async function updatePageCategory(
  input: UpsertPageCategoryInput,
): Promise<{ category: PageCategoryRecord } | { error: string }> {
  const id = String(input.id ?? '').trim()
  if (!id) return { error: 'Missing category.' }
  const title = String(input.title ?? '').trim().slice(0, 120) || 'Untitled category'
  const fromSlug = normalizePageCategorySlug(String(input.slug ?? ''))
  const fromTitle = normalizePageCategorySlug(title)
  const base = fromSlug || fromTitle
  if (!base) return { error: 'Enter a category title or slug.' }
  try {
    const existing = await findPageCategoryById(id)
    if (!existing) return { error: 'That category was not found.' }
    const slug = await uniqueSlug(base, id)
    const [row] = await db
      .update(sfPagesCategories)
      .set({
        title,
        slug,
        description: String(input.description ?? '').trim().slice(0, 2000),
        sortOrder: parseSortOrder(input.sortOrder, existing.sortOrder),
        updatedAt: new Date(),
      })
      .where(eq(sfPagesCategories.id, id))
      .returning()
    if (!row) return { error: 'That category was not found.' }
    return { category: mapCategory(row) }
  } catch (error) {
    const missing = tableMissingMessage(error)
    if (missing) return { error: missing }
    return { error: error instanceof Error ? error.message : 'Could not save category.' }
  }
}

export async function deletePageCategory(
  id: string,
): Promise<{ ok: true } | { error: string }> {
  const trimmed = id.trim()
  if (!trimmed) return { error: 'Missing category.' }
  try {
    const deleted = await db
      .delete(sfPagesCategories)
      .where(eq(sfPagesCategories.id, trimmed))
      .returning({ id: sfPagesCategories.id })
    if (deleted.length === 0) return { error: 'That category was not found.' }
    return { ok: true }
  } catch (error) {
    const missing = tableMissingMessage(error)
    if (missing) return { error: missing }
    return { error: error instanceof Error ? error.message : 'Could not delete category.' }
  }
}

/** Resolve a category id for save. Empty clears. Unknown id errors. */
export async function assertPageCategoryId(
  raw: unknown,
): Promise<{ id: string | null } | { error: string }> {
  const id = String(raw ?? '').trim()
  if (!id) return { id: null }
  const found = await findPageCategoryById(id)
  if (!found) return { error: 'Selected category was not found.' }
  return { id: found.id }
}
