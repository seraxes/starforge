/**
 * Marketplace categories — admin tree.
 * Titles and descriptions are content-locale files, not columns on the row.
 */

import 'server-only'

import { unlink } from 'node:fs/promises'

import { asc, eq } from 'drizzle-orm'

import { db } from '@/core/db'
import { buildMarketplaceCategoryKey } from '@/core/i18n/content-locale-keys'
import {
  getContentLocaleFilePath,
  invalidateContentLocaleCatalog,
  listContentLocaleCodesOnDisk,
  readContentLocaleFile,
} from '@/core/i18n/content-locales'
import { syncMarketplaceCategoryLocalesToFiles } from '@/core/i18n/content-locales/sync'
import { pickContentLocaleText } from '@/core/i18n/locale-text.server'
import type { LocaleTextMap } from '@/core/i18n/locale-text'

import {
  normalizeCategorySlug,
  validateCategoryFields,
  type CategoryFieldInput,
} from './category-rules'
import { sfMarketplaceCategories } from './schema'
import type { MarketplaceCategoryRecord } from './types'

export type MarketplaceCategoryLocaleMaps = {
  titleLocales: LocaleTextMap
  descriptionLocales: LocaleTextMap
}

export type UpsertMarketplaceCategoryInput = CategoryFieldInput & {
  id?: string
  titleLocales?: LocaleTextMap
  descriptionLocales?: LocaleTextMap
}

function tableMissingMessage(error: unknown): string | null {
  const msg = error instanceof Error ? error.message : String(error)
  if (msg.includes('sf_marketplace_categories') || /does not exist|relation/i.test(msg)) {
    return 'sf_marketplace_categories missing — run npm run db:migrate.'
  }
  return null
}

async function uniqueSlug(base: string, exceptId?: string): Promise<string> {
  const root = base || 'category'
  let slug = root
  for (let n = 2; n < 60; n += 1) {
    const existing = await findMarketplaceCategoryBySlug(slug)
    if (!existing || existing.id === exceptId) return slug
    slug = `${root}-${n}`.slice(0, 120)
  }
  return `${root}-${crypto.randomUUID().slice(0, 8)}`.slice(0, 120)
}

async function defaultLocaleTitleDescription(
  categoryId: string,
): Promise<{ title: string; description: string }> {
  const title = await pickContentLocaleText(
    buildMarketplaceCategoryKey(categoryId, 'title'),
    '',
  )
  const description = await pickContentLocaleText(
    buildMarketplaceCategoryKey(categoryId, 'text'),
    '',
  )
  return { title: title.trim(), description: description.trim() }
}

function mapCategoryRow(
  row: typeof sfMarketplaceCategories.$inferSelect,
  copy: { title: string; description: string },
): MarketplaceCategoryRecord {
  return {
    id: row.id,
    title: copy.title.trim() || 'Untitled category',
    slug: (row.slug || '').trim(),
    description: copy.description.trim(),
    parentId: (row.parentId || '').trim(),
    enabled: row.enabled !== false,
    sortOrder:
      typeof row.sortOrder === 'number' && Number.isFinite(row.sortOrder)
        ? Math.trunc(row.sortOrder)
        : 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

/** Depth + tree order for admin lists and parent pickers. */
export function orderMarketplaceCategoriesTree<
  T extends { id: string; parentId: string; sortOrder: number; title: string },
>(rows: T[]): Array<T & { depth: number }> {
  const byParent = new Map<string, T[]>()
  for (const row of rows) {
    const key = row.parentId && rows.some((r) => r.id === row.parentId) ? row.parentId : ''
    const list = byParent.get(key) ?? []
    list.push(row)
    byParent.set(key, list)
  }
  for (const list of byParent.values()) {
    list.sort(
      (a, b) =>
        a.sortOrder - b.sortOrder || a.title.localeCompare(b.title) || a.id.localeCompare(b.id),
    )
  }
  const out: Array<T & { depth: number }> = []
  const walk = (parentKey: string, depth: number) => {
    for (const row of byParent.get(parentKey) ?? []) {
      out.push({ ...row, depth })
      walk(row.id, depth + 1)
    }
  }
  walk('', 0)
  return out
}

export function collectMarketplaceCategorySubtreeIds(
  rootId: string,
  categories: Array<{ id: string; parentId: string }>,
): string[] {
  const root = rootId.trim()
  if (!root) return []
  const byParent = new Map<string, string[]>()
  for (const row of categories) {
    const key = (row.parentId || '').trim()
    const list = byParent.get(key) ?? []
    list.push(row.id)
    byParent.set(key, list)
  }
  const out: string[] = []
  const walk = (id: string) => {
    out.push(id)
    for (const child of byParent.get(id) ?? []) walk(child)
  }
  walk(root)
  return out
}

async function resolveParentId(
  raw: unknown,
  exceptId?: string,
): Promise<{ parentId: string } | { error: string }> {
  const parentId = String(raw ?? '').trim()
  if (!parentId) return { parentId: '' }
  if (exceptId && parentId === exceptId) {
    return { error: 'A category cannot be its own parent.' }
  }
  const parent = await findMarketplaceCategoryById(parentId)
  if (!parent) return { error: 'Selected parent category was not found.' }
  if (exceptId) {
    const all = await listMarketplaceCategories()
    const subtree = new Set(collectMarketplaceCategorySubtreeIds(exceptId, all))
    if (subtree.has(parentId)) {
      return { error: 'A category cannot nest under one of its own children.' }
    }
  }
  return { parentId }
}

export async function findMarketplaceCategoryById(
  id: string,
): Promise<MarketplaceCategoryRecord | null> {
  const trimmed = id.trim()
  if (!trimmed) return null
  try {
    const [row] = await db
      .select()
      .from(sfMarketplaceCategories)
      .where(eq(sfMarketplaceCategories.id, trimmed))
      .limit(1)
    if (!row) return null
    const copy = await defaultLocaleTitleDescription(trimmed)
    return mapCategoryRow(row, copy)
  } catch {
    return null
  }
}

export async function findMarketplaceCategoryBySlug(
  slug: string,
): Promise<MarketplaceCategoryRecord | null> {
  const trimmed = slug.trim()
  if (!trimmed) return null
  try {
    const [row] = await db
      .select()
      .from(sfMarketplaceCategories)
      .where(eq(sfMarketplaceCategories.slug, trimmed))
      .limit(1)
    if (!row) return null
    const copy = await defaultLocaleTitleDescription(row.id)
    return mapCategoryRow(row, copy)
  } catch {
    return null
  }
}

export async function listMarketplaceCategories(): Promise<MarketplaceCategoryRecord[]> {
  try {
    const rows = await db
      .select()
      .from(sfMarketplaceCategories)
      .orderBy(
        asc(sfMarketplaceCategories.sortOrder),
        asc(sfMarketplaceCategories.slug),
        asc(sfMarketplaceCategories.id),
      )
    return Promise.all(
      rows.map(async (row) => {
        const copy = await defaultLocaleTitleDescription(row.id)
        return mapCategoryRow(row, copy)
      }),
    )
  } catch {
    return []
  }
}

export async function loadMarketplaceCategoryLocaleMaps(
  categoryId: string,
  locales: string[],
): Promise<MarketplaceCategoryLocaleMaps> {
  const titleKey = buildMarketplaceCategoryKey(categoryId, 'title')
  const textKey = buildMarketplaceCategoryKey(categoryId, 'text')
  const titleLocales: LocaleTextMap = {}
  const descriptionLocales: LocaleTextMap = {}
  for (const locale of locales) {
    const file = await readContentLocaleFile(locale, 'marketplace', categoryId)
    const title = file[titleKey]
    const description = file[textKey]
    if (title) titleLocales[locale] = title
    if (description) descriptionLocales[locale] = description
  }
  return { titleLocales, descriptionLocales }
}

async function persistCategoryLocales(
  categoryId: string,
  title: string,
  description: string,
  input: UpsertMarketplaceCategoryInput,
): Promise<void> {
  await syncMarketplaceCategoryLocalesToFiles({
    categoryId,
    title,
    description,
    titleLocales: input.titleLocales,
    descriptionLocales: input.descriptionLocales,
  })
}

export async function createMarketplaceCategory(
  input: UpsertMarketplaceCategoryInput,
): Promise<{ category: MarketplaceCategoryRecord } | { error: string }> {
  const validated = validateCategoryFields(input)
  if (!validated.ok) return { error: validated.error }
  const parent = await resolveParentId(validated.values.parentId)
  if ('error' in parent) return parent
  const slug = await uniqueSlug(
    normalizeCategorySlug(validated.values.slug) ||
      normalizeCategorySlug(validated.values.title),
  )
  const id = (input.id || '').trim() || crypto.randomUUID()
  try {
    await db.insert(sfMarketplaceCategories).values({
      id,
      slug,
      parentId: parent.parentId || null,
      enabled: validated.values.enabled,
      sortOrder: validated.values.sortOrder,
    })
    await persistCategoryLocales(
      id,
      validated.values.title,
      validated.values.description,
      input,
    )
    const created = await findMarketplaceCategoryById(id)
    if (!created) return { error: 'Category created but could not be reloaded.' }
    return { category: created }
  } catch (error) {
    const missing = tableMissingMessage(error)
    if (missing) return { error: missing }
    return {
      error: error instanceof Error ? error.message : 'Could not create category.',
    }
  }
}

export async function updateMarketplaceCategory(
  input: UpsertMarketplaceCategoryInput & { id: string },
): Promise<{ category: MarketplaceCategoryRecord } | { error: string }> {
  const id = input.id.trim()
  if (!id) return { error: 'Missing category id.' }
  const current = await findMarketplaceCategoryById(id)
  if (!current) return { error: 'Category not found.' }

  const validated = validateCategoryFields(input, {
    title: current.title,
    description: current.description,
    slug: current.slug,
    parentId: current.parentId,
    enabled: current.enabled,
    sortOrder: current.sortOrder,
  })
  if (!validated.ok) return { error: validated.error }

  const parent = await resolveParentId(validated.values.parentId, id)
  if ('error' in parent) return parent
  const slug = await uniqueSlug(
    normalizeCategorySlug(validated.values.slug) ||
      normalizeCategorySlug(validated.values.title) ||
      current.slug,
    id,
  )
  try {
    await db
      .update(sfMarketplaceCategories)
      .set({
        slug,
        parentId: parent.parentId || null,
        enabled: validated.values.enabled,
        sortOrder: validated.values.sortOrder,
      })
      .where(eq(sfMarketplaceCategories.id, id))
    await persistCategoryLocales(
      id,
      validated.values.title,
      validated.values.description,
      input,
    )
    const updated = await findMarketplaceCategoryById(id)
    if (!updated) return { error: 'Category updated but could not be reloaded.' }
    return { category: updated }
  } catch (error) {
    const missing = tableMissingMessage(error)
    if (missing) return { error: missing }
    return {
      error: error instanceof Error ? error.message : 'Could not update category.',
    }
  }
}

async function removeCategoryLocaleFiles(categoryId: string): Promise<void> {
  const codes = await listContentLocaleCodesOnDisk()
  for (const locale of codes) {
    const filePath = getContentLocaleFilePath(locale, 'marketplace', categoryId)
    try {
      await unlink(filePath)
      invalidateContentLocaleCatalog(locale)
    } catch {
      /* missing file */
    }
  }
}

export async function deleteMarketplaceCategory(
  id: string,
): Promise<{ ok: true } | { error: string }> {
  const trimmed = id.trim()
  if (!trimmed) return { error: 'Missing category id.' }
  try {
    await db
      .update(sfMarketplaceCategories)
      .set({ parentId: null })
      .where(eq(sfMarketplaceCategories.parentId, trimmed))
    await db
      .delete(sfMarketplaceCategories)
      .where(eq(sfMarketplaceCategories.id, trimmed))
    await removeCategoryLocaleFiles(trimmed)
    return { ok: true }
  } catch (error) {
    const missing = tableMissingMessage(error)
    if (missing) return { error: missing }
    return {
      error: error instanceof Error ? error.message : 'Could not delete category.',
    }
  }
}
