/**
 * Event categories — editorial labels with ACL and a registration form.
 * Translations are content-locale files, not columns on the row.
 */

import 'server-only'

import { unlink } from 'node:fs/promises'

import { asc, eq } from 'drizzle-orm'

import { canSeeNavAccessTags, normalizeAccessTags } from '@/core/acl/nav-access'
import type { AccessViewer } from '@/core/acl/types'
import { db } from '@/core/db'
import { buildEventCategoryKey } from '@/core/i18n/content-locale-keys'
import {
  getContentLocaleFilePath,
  invalidateContentLocaleCatalog,
  listContentLocaleCodesOnDisk,
  readContentLocaleFile,
} from '@/core/i18n/content-locales'
import { pickContentLocaleText } from '@/core/i18n/locale-text.server'
import type { LocaleTextMap } from '@/core/i18n/locale-text'
import { withLocalePrefix } from '@/core/i18n/path'
import type { AppLocale } from '@/core/i18n/locales'
import { syncEventCategoryLocalesToFiles } from '@/core/i18n/content-locales/sync'
import { loadFormDefinition } from '@/modules/forms/api'

import { sfEventCategories } from './schema'
import type { EventCategoryRecord } from './types'

export type EventCategoryLocaleMaps = {
  titleLocales: LocaleTextMap
  descriptionLocales: LocaleTextMap
}

export type UpsertEventCategoryInput = {
  id?: string
  title: string
  slug?: string
  description?: string
  registrationFormId?: unknown
  published?: unknown
  sortOrder?: unknown
  accessTags?: unknown
  titleLocales?: LocaleTextMap
  descriptionLocales?: LocaleTextMap
}

function mapCategory(row: typeof sfEventCategories.$inferSelect): EventCategoryRecord {
  return {
    id: row.id,
    title: row.title?.trim() || 'Untitled category',
    slug: (row.slug || '').trim(),
    description: (row.description || '').trim(),
    registrationFormId: (row.registrationFormId || '').trim(),
    published: row.published !== false,
    sortOrder:
      typeof row.sortOrder === 'number' && Number.isFinite(row.sortOrder)
        ? Math.trunc(row.sortOrder)
        : 0,
    accessTags: normalizeAccessTags({ accessTags: row.accessTags }),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function normalizeAccessTagsForDb(raw: unknown): string[] {
  const tags = normalizeAccessTags({ accessTags: raw })
  if (tags.length === 1 && tags[0] === 'public') return []
  return tags
}

function normalizeSlug(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
}

function parsePublished(raw: unknown, fallback: boolean): boolean {
  if (typeof raw === 'boolean') return raw
  if (raw == null || raw === '') return fallback
  const s = String(raw).trim().toLowerCase()
  if (s === '0' || s === 'false' || s === 'off' || s === 'no') return false
  if (s === '1' || s === 'true' || s === 'on' || s === 'yes') return true
  return fallback
}

function parseSortOrder(raw: unknown, fallback: number): number {
  if (raw == null || raw === '') return fallback
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim())
  if (!Number.isFinite(n)) return fallback
  return Math.max(-10000, Math.min(10000, Math.trunc(n)))
}

function tableMissingMessage(error: unknown): string | null {
  const msg = error instanceof Error ? error.message : String(error)
  if (msg.includes('sf_event_categories') || /does not exist|relation/i.test(msg)) {
    return 'sf_event_categories missing — run npm run db:migrate (or db:core:push).'
  }
  return null
}

async function uniqueSlug(base: string, exceptId?: string): Promise<string> {
  const root = base || 'category'
  let slug = root
  for (let n = 2; n < 60; n += 1) {
    const existing = await findEventCategoryBySlug(slug)
    if (!existing || existing.id === exceptId) return slug
    slug = `${root}-${n}`.slice(0, 120)
  }
  return `${root}-${crypto.randomUUID().slice(0, 8)}`.slice(0, 120)
}

export async function assertRegistrationFormId(
  raw: unknown,
): Promise<{ id: string } | { error: string }> {
  const id = String(raw ?? '').trim()
  if (!id) return { id: '' }
  const loaded = await loadFormDefinition(id)
  if (loaded.source !== 'database') {
    return { error: 'Selected registration form was not found. Create it under Forms.' }
  }
  return { id: loaded.id || id }
}

export async function findEventCategoryById(
  id: string,
): Promise<EventCategoryRecord | null> {
  const trimmed = id.trim()
  if (!trimmed) return null
  try {
    const [row] = await db
      .select()
      .from(sfEventCategories)
      .where(eq(sfEventCategories.id, trimmed))
      .limit(1)
    return row ? mapCategory(row) : null
  } catch {
    return null
  }
}

export async function findEventCategoryBySlug(
  slug: string,
): Promise<EventCategoryRecord | null> {
  const trimmed = slug.trim()
  if (!trimmed) return null
  try {
    const [row] = await db
      .select()
      .from(sfEventCategories)
      .where(eq(sfEventCategories.slug, trimmed))
      .limit(1)
    return row ? mapCategory(row) : null
  } catch {
    return null
  }
}

export async function listEventCategories(): Promise<EventCategoryRecord[]> {
  try {
    const rows = await db
      .select()
      .from(sfEventCategories)
      .orderBy(
        asc(sfEventCategories.sortOrder),
        asc(sfEventCategories.title),
        asc(sfEventCategories.id),
      )
    return rows.map(mapCategory)
  } catch {
    return []
  }
}

export async function loadEventCategoryLocaleMaps(
  categoryId: string,
  locales: string[],
): Promise<EventCategoryLocaleMaps> {
  const titleKey = buildEventCategoryKey(categoryId, 'title')
  const textKey = buildEventCategoryKey(categoryId, 'text')
  const titleLocales: LocaleTextMap = {}
  const descriptionLocales: LocaleTextMap = {}
  for (const locale of locales) {
    const file = await readContentLocaleFile(locale, 'events', categoryId)
    const title = file[titleKey]
    const description = file[textKey]
    if (title) titleLocales[locale] = title
    if (description) descriptionLocales[locale] = description
  }
  return { titleLocales, descriptionLocales }
}

async function persistCategoryLocales(
  category: EventCategoryRecord,
  input: UpsertEventCategoryInput,
): Promise<void> {
  await syncEventCategoryLocalesToFiles({
    categoryId: category.id,
    title: category.title,
    description: category.description,
    titleLocales: input.titleLocales,
    descriptionLocales: input.descriptionLocales,
  })
}

export async function createEventCategory(
  input: UpsertEventCategoryInput,
): Promise<{ category: EventCategoryRecord } | { error: string }> {
  const title = input.title.trim().slice(0, 200) || 'Untitled category'
  const description = String(input.description ?? '').trim().slice(0, 4000)
  const form = await assertRegistrationFormId(input.registrationFormId)
  if ('error' in form) return form
  const slug = await uniqueSlug(normalizeSlug(input.slug) || normalizeSlug(title))
  const id = (input.id || '').trim() || crypto.randomUUID()
  try {
    await db.insert(sfEventCategories).values({
      id,
      title,
      slug,
      description,
      registrationFormId: form.id,
      published: parsePublished(input.published, true),
      sortOrder: parseSortOrder(input.sortOrder, 0),
      accessTags: normalizeAccessTagsForDb(input.accessTags),
    })
    const created = await findEventCategoryById(id)
    if (!created) return { error: 'Category created but could not be reloaded.' }
    await persistCategoryLocales(created, input)
    return { category: created }
  } catch (error) {
    const missing = tableMissingMessage(error)
    if (missing) return { error: missing }
    return {
      error: error instanceof Error ? error.message : 'Could not create category.',
    }
  }
}

export async function updateEventCategory(
  input: UpsertEventCategoryInput & { id: string },
): Promise<{ category: EventCategoryRecord } | { error: string }> {
  const id = input.id.trim()
  if (!id) return { error: 'Missing category id.' }
  const current = await findEventCategoryById(id)
  if (!current) return { error: 'Category not found.' }

  const title = input.title.trim().slice(0, 200) || current.title
  const description =
    input.description !== undefined
      ? String(input.description).trim().slice(0, 4000)
      : current.description
  const form = await assertRegistrationFormId(
    input.registrationFormId !== undefined
      ? input.registrationFormId
      : current.registrationFormId,
  )
  if ('error' in form) return form
  const slug = await uniqueSlug(
    normalizeSlug(input.slug) || normalizeSlug(title) || current.slug,
    id,
  )
  try {
    await db
      .update(sfEventCategories)
      .set({
        title,
        slug,
        description,
        registrationFormId: form.id,
        published: parsePublished(input.published, current.published),
        sortOrder: parseSortOrder(input.sortOrder, current.sortOrder),
        accessTags:
          input.accessTags !== undefined
            ? normalizeAccessTagsForDb(input.accessTags)
            : normalizeAccessTagsForDb(current.accessTags),
      })
      .where(eq(sfEventCategories.id, id))
    const updated = await findEventCategoryById(id)
    if (!updated) return { error: 'Category updated but could not be reloaded.' }
    await persistCategoryLocales(updated, input)
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
    const filePath = getContentLocaleFilePath(locale, 'events', categoryId)
    try {
      await unlink(filePath)
      invalidateContentLocaleCatalog(locale)
    } catch {
      /* missing file */
    }
  }
}

export async function deleteEventCategory(
  id: string,
): Promise<{ ok: true } | { error: string }> {
  const trimmed = id.trim()
  if (!trimmed) return { error: 'Missing category id.' }
  try {
    await db.delete(sfEventCategories).where(eq(sfEventCategories.id, trimmed))
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

/** Published category the viewer may see. Missing or unpublished categories fail the gate. */
export function categoryAllowsViewer(
  categoryId: string,
  category: Pick<EventCategoryRecord, 'published' | 'accessTags'> | null,
  viewer: AccessViewer,
): boolean {
  if (!categoryId.trim()) return true
  if (!category || !category.published) return false
  return canSeeNavAccessTags(category.accessTags, viewer)
}

export async function publicCategoryLabel(
  category: EventCategoryRecord,
  locale?: AppLocale,
): Promise<{ title: string; href: string }> {
  const title = await pickContentLocaleText(
    buildEventCategoryKey(category.id, 'title'),
    category.title,
  )
  const slug = category.slug || category.id
  return {
    title,
    href: withLocalePrefix(`/events?category=${encodeURIComponent(slug)}`, locale),
  }
}
