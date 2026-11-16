/**
 * product:pages persistence.
 * Default-locale scalars stay on `sf_pages`. Other locales go to content-locale files.
 */

import 'server-only'

import { and, asc, desc, eq, gte, ilike, inArray, notInArray, or, sql } from 'drizzle-orm'

import { db } from '@/core/db'
import { invalidatePublishedPage } from '@/core/content/revalidate'
import { buildPageKey } from '@/core/i18n/content-locale-keys'
import {
  listContentLocaleCodesOnDisk,
  readContentLocaleFile,
} from '@/core/i18n/content-locales/store'
import { syncPageLocalesToFiles } from '@/core/i18n/content-locales/sync'
import type { LocaleTextMap } from '@/core/i18n/locale-text'
import { sanitizeRichHtml } from '@/modules/rich-editor/api.server'

import { sfPages, sfPagesPageTags, sfPagesTags, sfPagesVersions } from './schema'
import { normalizePageSlug, normalizePageTagSlug } from './slug'
import {
  isPageStatus,
  type NavPageBind,
  PAGE_VERSION_KEEP,
  type PageListFilters,
  type PageLocaleMaps,
  type PageRecord,
  type PageStatus,
  type PageTagRecord,
  type PageVersionLocales,
  type PageVersionRecord,
  type SavePageInput,
} from './types'

function tableMissingMessage(error: unknown): string | null {
  const msg = error instanceof Error ? error.message : String(error)
  if (/sf_pages/i.test(msg) && /does not exist|relation/i.test(msg)) {
    return 'sf_pages missing — run npm run db:migrate.'
  }
  return null
}

function asStatus(value: string): PageStatus {
  return isPageStatus(value) ? value : 'draft'
}

function mapPage(
  row: typeof sfPages.$inferSelect,
  tags: PageTagRecord[],
): PageRecord {
  return {
    id: row.id,
    slug: row.slug,
    status: asStatus(row.status),
    title: row.title,
    body: row.body,
    metaTitle: row.metaTitle,
    metaDescription: row.metaDescription,
    metaMediaId: row.metaMediaId,
    tags,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

async function tagsForPage(pageId: string): Promise<PageTagRecord[]> {
  const rows = await db
    .select({
      id: sfPagesTags.id,
      title: sfPagesTags.title,
      slug: sfPagesTags.slug,
    })
    .from(sfPagesPageTags)
    .innerJoin(sfPagesTags, eq(sfPagesPageTags.tagId, sfPagesTags.id))
    .where(eq(sfPagesPageTags.pageId, pageId))
    .orderBy(asc(sfPagesTags.title))
  return rows
}

async function findRowBySlug(slug: string) {
  const [row] = await db.select().from(sfPages).where(eq(sfPages.slug, slug)).limit(1)
  return row ?? null
}

export async function findPageById(id: string): Promise<PageRecord | null> {
  const trimmed = id.trim()
  if (!trimmed) return null
  try {
    const [row] = await db.select().from(sfPages).where(eq(sfPages.id, trimmed)).limit(1)
    if (!row) return null
    return mapPage(row, await tagsForPage(row.id))
  } catch (error) {
    const missing = tableMissingMessage(error)
    if (missing) throw new Error(missing)
    throw error
  }
}

export async function findPageBySlug(slug: string): Promise<PageRecord | null> {
  const normalized = slug.trim()
  if (!normalized) return null
  try {
    const row = await findRowBySlug(normalized)
    if (!row) return null
    return mapPage(row, await tagsForPage(row.id))
  } catch (error) {
    const missing = tableMissingMessage(error)
    if (missing) throw new Error(missing)
    throw error
  }
}

export async function loadPageLocaleMaps(
  pageId: string,
  locales: string[],
): Promise<PageLocaleMaps> {
  const titleLocales: LocaleTextMap = {}
  const bodyLocales: LocaleTextMap = {}
  const metaTitleLocales: LocaleTextMap = {}
  const metaDescriptionLocales: LocaleTextMap = {}
  const titleKey = buildPageKey(pageId, 'title')
  const bodyKey = buildPageKey(pageId, 'html')
  const metaTitleKey = buildPageKey(pageId, 'metaTitle')
  const metaDescriptionKey = buildPageKey(pageId, 'metaDescription')
  for (const locale of locales) {
    const file = await readContentLocaleFile(locale, 'pages', pageId)
    const title = file[titleKey]
    const body = file[bodyKey]
    const metaTitle = file[metaTitleKey]
    const metaDescription = file[metaDescriptionKey]
    if (title) titleLocales[locale] = title
    if (body) bodyLocales[locale] = body
    if (metaTitle) metaTitleLocales[locale] = metaTitle
    if (metaDescription) metaDescriptionLocales[locale] = metaDescription
  }
  return { titleLocales, bodyLocales, metaTitleLocales, metaDescriptionLocales }
}

function likeTerm(raw: string): string {
  const cleaned = raw.replace(/[%_\\]/g, '').trim()
  return `%${cleaned}%`
}

export async function listPageTags(): Promise<Array<PageTagRecord & { pageCount: number }>> {
  try {
    const tags = await db.select().from(sfPagesTags).orderBy(asc(sfPagesTags.title))
    const counts = await db
      .select({
        tagId: sfPagesPageTags.tagId,
        pageCount: sql<number>`count(*)::int`,
      })
      .from(sfPagesPageTags)
      .groupBy(sfPagesPageTags.tagId)
    const byTag = new Map(counts.map((row) => [row.tagId, row.pageCount]))
    return tags.map((tag) => ({
      id: tag.id,
      title: tag.title,
      slug: tag.slug,
      pageCount: byTag.get(tag.id) ?? 0,
    }))
  } catch (error) {
    const missing = tableMissingMessage(error)
    if (missing) throw new Error(missing)
    throw error
  }
}

export async function createPageTag(
  title: string,
): Promise<{ tag: PageTagRecord } | { error: string }> {
  try {
    const id = await ensureTag(title)
    if (!id) return { error: 'Enter a tag name.' }
    const [tag] = await db.select().from(sfPagesTags).where(eq(sfPagesTags.id, id)).limit(1)
    if (!tag) return { error: 'Tag could not be saved.' }
    return { tag: { id: tag.id, title: tag.title, slug: tag.slug } }
  } catch (error) {
    const missing = tableMissingMessage(error)
    if (missing) return { error: missing }
    return { error: error instanceof Error ? error.message : 'Could not save tag.' }
  }
}

export async function renamePageTag(
  id: string,
  title: string,
): Promise<{ tag: PageTagRecord } | { error: string }> {
  const trimmed = id.trim()
  const label = title.trim().slice(0, 80)
  const slug = normalizePageTagSlug(label)
  if (!trimmed || !label || !slug) return { error: 'Enter a tag name.' }
  try {
    const [clash] = await db
      .select({ id: sfPagesTags.id })
      .from(sfPagesTags)
      .where(eq(sfPagesTags.slug, slug))
      .limit(1)
    if (clash && clash.id !== trimmed) return { error: 'That tag slug is already used.' }
    const [tag] = await db
      .update(sfPagesTags)
      .set({ title: label, slug, updatedAt: new Date() })
      .where(eq(sfPagesTags.id, trimmed))
      .returning()
    if (!tag) return { error: 'That tag was not found.' }
    return { tag: { id: tag.id, title: tag.title, slug: tag.slug } }
  } catch (error) {
    const missing = tableMissingMessage(error)
    if (missing) return { error: missing }
    return { error: error instanceof Error ? error.message : 'Could not rename tag.' }
  }
}

export async function deletePageTag(id: string): Promise<{ ok: true } | { error: string }> {
  const trimmed = id.trim()
  if (!trimmed) return { error: 'Missing tag.' }
  try {
    const deleted = await db
      .delete(sfPagesTags)
      .where(eq(sfPagesTags.id, trimmed))
      .returning({ id: sfPagesTags.id })
    if (deleted.length === 0) return { error: 'That tag was not found.' }
    return { ok: true }
  } catch (error) {
    const missing = tableMissingMessage(error)
    if (missing) return { error: missing }
    return { error: error instanceof Error ? error.message : 'Could not delete tag.' }
  }
}

export async function listPages(query: PageListFilters): Promise<PageRecord[]> {
  const sort = query.sort ?? 'updated'
  const dir = query.dir === 'asc' ? 'asc' : 'desc'
  const column =
    sort === 'title'
      ? sfPages.title
      : sort === 'slug'
        ? sfPages.slug
        : sort === 'status'
          ? sfPages.status
          : sfPages.updatedAt
  const order = dir === 'asc' ? asc(column) : desc(column)
  const q = (query.q ?? '').trim()
  const status = query.status === 'draft' || query.status === 'published' ? query.status : ''
  const tagId = (query.tagId ?? '').trim()
  const days = query.updatedWithinDays
  const filters = []
  if (q) {
    filters.push(
      or(
        ilike(sfPages.title, likeTerm(q)),
        ilike(sfPages.slug, likeTerm(q)),
        ilike(sfPages.metaTitle, likeTerm(q)),
        ilike(sfPages.metaDescription, likeTerm(q)),
      ),
    )
  }
  if (status) filters.push(eq(sfPages.status, status))
  if (typeof days === 'number' && days > 0) {
    filters.push(gte(sfPages.updatedAt, new Date(Date.now() - days * 24 * 60 * 60 * 1000)))
  }
  try {
    if (tagId) {
      const tagged = await db
        .select({ pageId: sfPagesPageTags.pageId })
        .from(sfPagesPageTags)
        .where(eq(sfPagesPageTags.tagId, tagId))
      const ids = tagged.map((row) => row.pageId)
      if (ids.length === 0) return []
      filters.push(inArray(sfPages.id, ids))
    }
    const rows = await db
      .select()
      .from(sfPages)
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(order, asc(sfPages.slug))
      .limit(500)
    return rows.map((row) => mapPage(row, []))
  } catch (error) {
    const missing = tableMissingMessage(error)
    if (missing) throw new Error(missing)
    throw error
  }
}

async function ensureTag(title: string): Promise<string | null> {
  const label = title.trim().slice(0, 80)
  const slug = normalizePageTagSlug(label)
  if (!label || !slug) return null
  const [existing] = await db
    .select({ id: sfPagesTags.id })
    .from(sfPagesTags)
    .where(eq(sfPagesTags.slug, slug))
    .limit(1)
  if (existing) return existing.id
  const id = crypto.randomUUID()
  await db.insert(sfPagesTags).values({ id, title: label, slug })
  return id
}

async function replacePageTags(pageId: string, raw: string): Promise<void> {
  const titles = raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 24)
  const tagIds: string[] = []
  for (const title of titles) {
    const id = await ensureTag(title)
    if (id && !tagIds.includes(id)) tagIds.push(id)
  }
  await db.delete(sfPagesPageTags).where(eq(sfPagesPageTags.pageId, pageId))
  if (tagIds.length === 0) return
  await db.insert(sfPagesPageTags).values(tagIds.map((tagId) => ({ pageId, tagId })))
}

function cleanInput(input: SavePageInput): SavePageInput {
  return {
    ...input,
    title: input.title.trim().slice(0, 300),
    body: sanitizeRichHtml(input.body),
    metaTitle: input.metaTitle.trim().slice(0, 300),
    metaDescription: input.metaDescription.trim().slice(0, 2000),
    metaMediaId: input.metaMediaId.trim().slice(0, 120),
    bodyLocales: sanitizeLocaleHtml(input.bodyLocales),
  }
}

function sanitizeLocaleHtml(map: LocaleTextMap | undefined): LocaleTextMap | undefined {
  if (!map) return undefined
  const out: LocaleTextMap = {}
  for (const [locale, value] of Object.entries(map)) {
    out[locale] = sanitizeRichHtml(value)
  }
  return out
}

function emptyVersionLocales(): PageVersionLocales {
  return { title: {}, body: {}, metaTitle: {}, metaDescription: {} }
}

async function snapshotPage(page: PageRecord): Promise<void> {
  let locales = emptyVersionLocales()
  try {
    const codes = await listContentLocaleCodesOnDisk()
    const maps = await loadPageLocaleMaps(page.id, codes)
    locales = {
      title: maps.titleLocales,
      body: maps.bodyLocales,
      metaTitle: maps.metaTitleLocales,
      metaDescription: maps.metaDescriptionLocales,
    }
  } catch {
    locales = emptyVersionLocales()
  }
  await db.insert(sfPagesVersions).values({
    id: crypto.randomUUID(),
    pageId: page.id,
    title: page.title,
    body: page.body,
    metaTitle: page.metaTitle,
    metaDescription: page.metaDescription,
    metaMediaId: page.metaMediaId,
    slug: page.slug,
    status: page.status,
    tags: page.tags.map((tag) => tag.title).join(', '),
    locales,
  })
  const keep = await db
    .select({ id: sfPagesVersions.id })
    .from(sfPagesVersions)
    .where(eq(sfPagesVersions.pageId, page.id))
    .orderBy(desc(sfPagesVersions.createdAt))
    .limit(PAGE_VERSION_KEEP)
  const keepIds = keep.map((row) => row.id)
  if (keepIds.length === 0) return
  await db
    .delete(sfPagesVersions)
    .where(and(eq(sfPagesVersions.pageId, page.id), notInArray(sfPagesVersions.id, keepIds)))
}

export async function listPageVersions(pageId: string): Promise<PageVersionRecord[]> {
  const trimmed = pageId.trim()
  if (!trimmed) return []
  try {
    const rows = await db
      .select()
      .from(sfPagesVersions)
      .where(eq(sfPagesVersions.pageId, trimmed))
      .orderBy(desc(sfPagesVersions.createdAt))
      .limit(PAGE_VERSION_KEEP)
    return rows.map((row) => ({
      id: row.id,
      pageId: row.pageId,
      title: row.title,
      body: row.body,
      metaTitle: row.metaTitle,
      metaDescription: row.metaDescription,
      metaMediaId: row.metaMediaId,
      slug: row.slug,
      status: asStatus(row.status),
      tags: row.tags,
      locales: row.locales ?? emptyVersionLocales(),
      createdAt: row.createdAt,
    }))
  } catch (error) {
    const missing = tableMissingMessage(error)
    if (missing) return []
    throw error
  }
}

async function persistLocales(page: PageRecord, input: SavePageInput): Promise<void> {
  await syncPageLocalesToFiles({
    pageId: page.id,
    title: page.title,
    body: page.body,
    metaTitle: page.metaTitle,
    metaDescription: page.metaDescription,
    titleLocales: input.titleLocales,
    bodyLocales: input.bodyLocales,
    metaTitleLocales: input.metaTitleLocales,
    metaDescriptionLocales: input.metaDescriptionLocales,
  })
}

export async function savePage(
  input: SavePageInput,
): Promise<{ page: PageRecord } | { error: string }> {
  const cleaned = cleanInput(input)
  const slug = normalizePageSlug(cleaned.slug) || normalizePageSlug(cleaned.title)
  if (!slug) return { error: 'Enter a slug.' }
  if (!cleaned.title) return { error: 'Enter a title.' }
  const status = cleaned.status

  try {
    const clash = await findRowBySlug(slug)
    const existingId = (cleaned.id ?? '').trim()
    if (clash && clash.id !== existingId) {
      return { error: 'That slug is already used.' }
    }

    if (!existingId) {
      const id = crypto.randomUUID()
      await db.transaction(async (tx) => {
        await tx.insert(sfPages).values({
          id,
          slug,
          status,
          title: cleaned.title,
          body: cleaned.body,
          metaTitle: cleaned.metaTitle,
          metaDescription: cleaned.metaDescription,
          metaMediaId: cleaned.metaMediaId,
        })
      })
      await replacePageTags(id, cleaned.tags)
      const page = await findPageById(id)
      if (!page) return { error: 'Page created but could not be reloaded.' }
      await persistLocales(page, cleaned)
      await invalidatePublishedPage({ slug: page.slug })
      return { page }
    }

    const previous = await findPageById(existingId)
    if (!previous) return { error: 'That page was not found.' }
    try {
      await snapshotPage(previous)
    } catch (error) {
      const missing = tableMissingMessage(error)
      if (missing) return { error: missing }
      throw error
    }
    await db
      .update(sfPages)
      .set({
        slug,
        status,
        title: cleaned.title,
        body: cleaned.body,
        metaTitle: cleaned.metaTitle,
        metaDescription: cleaned.metaDescription,
        metaMediaId: cleaned.metaMediaId,
        updatedAt: new Date(),
      })
      .where(eq(sfPages.id, existingId))
    await replacePageTags(existingId, cleaned.tags)
    const page = await findPageById(existingId)
    if (!page) return { error: 'Page saved but could not be reloaded.' }
    await persistLocales(page, cleaned)
    await invalidatePublishedPage({
      slug: page.slug,
      previousSlug: previous.slug,
      slugChanged: previous.slug !== page.slug,
    })
    return { page }
  } catch (error) {
    const missing = tableMissingMessage(error)
    if (missing) return { error: missing }
    return { error: error instanceof Error ? error.message : 'Could not save page.' }
  }
}

export async function deletePage(id: string): Promise<{ ok: true; slug: string } | { error: string }> {
  const trimmed = id.trim()
  if (!trimmed) return { error: 'Missing page.' }
  try {
    const previous = await findPageById(trimmed)
    if (!previous) return { error: 'That page was not found.' }
    await db.delete(sfPages).where(eq(sfPages.id, trimmed))
    await invalidatePublishedPage({ slug: previous.slug })
    return { ok: true, slug: previous.slug }
  } catch (error) {
    const missing = tableMissingMessage(error)
    if (missing) return { error: missing }
    return { error: error instanceof Error ? error.message : 'Could not delete page.' }
  }
}

export async function restorePageVersion(
  pageId: string,
  versionId: string,
): Promise<{ page: PageRecord } | { error: string }> {
  const page = pageId.trim()
  const version = versionId.trim()
  if (!page || !version) return { error: 'Missing version.' }
  try {
    const [row] = await db
      .select()
      .from(sfPagesVersions)
      .where(and(eq(sfPagesVersions.id, version), eq(sfPagesVersions.pageId, page)))
      .limit(1)
    if (!row) return { error: 'That version was not found.' }
    const locales = row.locales ?? emptyVersionLocales()
    return savePage({
      id: page,
      slug: row.slug,
      status: asStatus(row.status),
      title: row.title,
      body: row.body,
      metaTitle: row.metaTitle,
      metaDescription: row.metaDescription,
      metaMediaId: row.metaMediaId,
      tags: row.tags,
      titleLocales: locales.title,
      bodyLocales: locales.body,
      metaTitleLocales: locales.metaTitle,
      metaDescriptionLocales: locales.metaDescription,
    })
  } catch (error) {
    const missing = tableMissingMessage(error)
    if (missing) return { error: missing }
    return { error: error instanceof Error ? error.message : 'Could not restore version.' }
  }
}

/** Admin nav picker. Drafts included (editors bind before publish). */
export async function listNavPageOptions(): Promise<NavPageBind[]> {
  try {
    const rows = await db
      .select({
        id: sfPages.id,
        title: sfPages.title,
        slug: sfPages.slug,
      })
      .from(sfPages)
      .orderBy(asc(sfPages.title))
      .limit(200)
    return rows
      .filter((row) => row.slug.trim())
      .map((row) => ({
        id: row.id,
        title: row.title.trim() || row.slug,
        slug: row.slug,
      }))
  } catch {
    return []
  }
}

/** Nav remap lookup. Payload numeric id → Starforge uuid. */
export async function findNavPageByLegacyId(legacyId: number): Promise<NavPageBind | null> {
  if (!Number.isFinite(legacyId)) return null
  try {
    const [row] = await db
      .select({
        id: sfPages.id,
        title: sfPages.title,
        slug: sfPages.slug,
      })
      .from(sfPages)
      .where(eq(sfPages.payloadLegacyId, Math.trunc(legacyId)))
      .limit(1)
    if (!row || !row.slug.trim()) return null
    return {
      id: row.id,
      title: row.title.trim() || row.slug,
      slug: row.slug,
    }
  } catch {
    return null
  }
}

/** Seed / menu lookup by shared slug. Drafts included. */
export async function findNavPageBySlug(slug: string): Promise<NavPageBind | null> {
  const normalized = slug.trim()
  if (!normalized) return null
  try {
    const row = await findRowBySlug(normalized)
    if (!row || !row.slug.trim()) return null
    return {
      id: row.id,
      title: row.title.trim() || row.slug,
      slug: row.slug,
    }
  } catch {
    return null
  }
}

/** Published rows for the port. Caller applies locale text. */
export async function listPublishedPageRows(): Promise<PageRecord[]> {
  const rows = await db
    .select()
    .from(sfPages)
    .where(eq(sfPages.status, 'published'))
    .orderBy(asc(sfPages.slug))
    .limit(1000)
  return rows.map((row) => mapPage(row, []))
}

export async function findPageRowBySlug(
  slug: string,
  options: { publishedOnly: boolean },
): Promise<PageRecord | null> {
  const normalized = slug.trim()
  if (!normalized) return null
  const where = options.publishedOnly
    ? and(eq(sfPages.slug, normalized), eq(sfPages.status, 'published'))
    : eq(sfPages.slug, normalized)
  const [row] = await db.select().from(sfPages).where(where).limit(1)
  if (!row) return null
  return mapPage(row, await tagsForPage(row.id))
}
