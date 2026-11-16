/**
 * Idempotent copy of Payload `pages` into product:pages.
 * Called from `scripts/db-migrate.mts` after Payload migrate.
 * `db:migrate` drops the payload schema after this copy.
 *
 * Starforge page ids are uuids. payload_legacy_id is the Payload numeric id
 * so Nav can rewrite stored numbers without coercing them back to numbers.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Client } from 'pg'

import { pageBodyToHtml } from '@/core/content/lexical-to-html'
import { buildPageKey } from '@/core/i18n/content-locale-keys'
import { getContentLocaleFilePath } from '@/core/i18n/content-locales/paths'
import { DEFAULT_LOCALE } from '@/core/i18n/locales'
import { remapNavDocumentPageIds } from '@/core/nav/remap-page-ids'

import { PAGE_VERSION_KEEP } from './types'

export type PayloadPagesMigrationResult = {
  pagesCopied: number
  pagesSkipped: number
  tagsCopied: number
  versionsCopied: number
  localesWritten: number
  navItemsRemapped: number
  note?: string
}

type LocaleRow = {
  locale: string
  title: string
  body: string
  metaTitle: string
  metaDescription: string
}

const EMPTY: PayloadPagesMigrationResult = {
  pagesCopied: 0,
  pagesSkipped: 0,
  tagsCopied: 0,
  versionsCopied: 0,
  localesWritten: 0,
  navItemsRemapped: 0,
}

async function regclass(client: Client, name: string): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    'SELECT to_regclass($1) IS NOT NULL AS exists',
    [name],
  )
  return Boolean(result.rows[0]?.exists)
}

async function columnExists(
  client: Client,
  table: string,
  column: string,
): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'payload' AND table_name = $1 AND column_name = $2
     ) AS exists`,
    [table, column],
  )
  return Boolean(result.rows[0]?.exists)
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value)
}

function asStatus(value: string): 'draft' | 'published' {
  return value === 'published' ? 'published' : 'draft'
}

async function writeLocaleFile(
  locale: string,
  pageId: string,
  entries: Record<string, string>,
): Promise<void> {
  const filePath = getContentLocaleFilePath(locale, 'pages', pageId)
  await mkdir(path.dirname(filePath), { recursive: true })
  let current: Record<string, unknown> = {}
  try {
    const parsed: unknown = JSON.parse(await readFile(filePath, 'utf8'))
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      current = parsed as Record<string, unknown>
    }
  } catch {
    current = {}
  }
  for (const [key, value] of Object.entries(entries)) {
    const trimmed = value.trim()
    if (trimmed) current[key] = trimmed
    else delete current[key]
  }
  await writeFile(filePath, `${JSON.stringify(current, null, 2)}\n`, 'utf8')
}

function localeEntries(pageId: string, row: LocaleRow): Record<string, string> {
  return {
    [buildPageKey(pageId, 'title')]: row.title,
    [buildPageKey(pageId, 'html')]: row.body,
    [buildPageKey(pageId, 'metaTitle')]: row.metaTitle,
    [buildPageKey(pageId, 'metaDescription')]: row.metaDescription,
  }
}

function pickDefault(rows: LocaleRow[]): LocaleRow | null {
  if (rows.length === 0) return null
  return rows.find((row) => row.locale === DEFAULT_LOCALE) ?? rows[0] ?? null
}

export async function migratePayloadPages(client: Client): Promise<PayloadPagesMigrationResult> {
  if (!(await regclass(client, 'public.sf_pages'))) {
    return { ...EMPTY, note: 'sf_pages missing' }
  }
  if (!(await regclass(client, 'payload.pages'))) {
    return { ...EMPTY, note: 'payload.pages missing' }
  }

  const result: PayloadPagesMigrationResult = { ...EMPTY }
  const hasLocales = await regclass(client, 'payload.pages_locales')
  const hasPageMedia = await columnExists(client, 'pages', 'meta_media_id')
  const hasTags = await regclass(client, 'payload.tags')
  const hasPageRels = await regclass(client, 'payload.pages_rels')
  const localeJobs: Array<{ pageId: string; rows: LocaleRow[] }> = []

  await client.query('BEGIN')
  try {
    const tagIds = new Map<number, string>()
    if (hasTags && hasPageRels) {
      const tags = await client.query<{
        id: number
        title: string
        slug: string
        created_at: Date
        updated_at: Date
      }>(
        `SELECT t.id, t.title, t.slug, t.created_at, t.updated_at
         FROM payload.tags t
         WHERE EXISTS (
           SELECT 1 FROM payload.pages_rels r WHERE r.tags_id = t.id
         )`,
      )
      for (const tag of tags.rows) {
        const slug = asText(tag.slug).trim().slice(0, 120)
        const title = asText(tag.title).trim().slice(0, 80) || slug
        if (!slug || !title) continue
        const existing = await client.query<{ id: string }>(
          'SELECT id FROM sf_pages_tags WHERE payload_legacy_id = $1 LIMIT 1',
          [tag.id],
        )
        if (existing.rows[0]) {
          tagIds.set(tag.id, existing.rows[0].id)
          continue
        }
        const bySlug = await client.query<{ id: string; payload_legacy_id: number | null }>(
          'SELECT id, payload_legacy_id FROM sf_pages_tags WHERE slug = $1 LIMIT 1',
          [slug],
        )
        if (bySlug.rows[0]) {
          tagIds.set(tag.id, bySlug.rows[0].id)
          if (bySlug.rows[0].payload_legacy_id == null) {
            await client.query(
              'UPDATE sf_pages_tags SET payload_legacy_id = $1 WHERE id = $2 AND payload_legacy_id IS NULL',
              [tag.id, bySlug.rows[0].id],
            )
          }
          continue
        }
        const id = crypto.randomUUID()
        await client.query(
          `INSERT INTO sf_pages_tags (id, title, slug, payload_legacy_id, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [id, title, slug, tag.id, tag.created_at, tag.updated_at],
        )
        tagIds.set(tag.id, id)
        result.tagsCopied += 1
      }
    }

    const mediaSelect = hasPageMedia ? `COALESCE(p.meta_media_id, '')` : `''`
    const pages = await client.query<{
      id: number
      slug: string
      status: string
      created_at: Date
      updated_at: Date
      meta_media_id: string
    }>(
      `SELECT p.id, p.slug, p._status::text AS status, p.created_at, p.updated_at,
              ${mediaSelect} AS meta_media_id
       FROM payload.pages p`,
    )

    for (const page of pages.rows) {
      const slug = asText(page.slug).trim()
      if (!slug) {
        result.pagesSkipped += 1
        continue
      }
      const locales = await loadPageLocales(client, page.id, hasLocales)
      const fallback = pickDefault(locales) ?? {
        locale: DEFAULT_LOCALE,
        title: slug,
        body: '',
        metaTitle: '',
        metaDescription: '',
      }
      const title = fallback.title.trim().slice(0, 300) || slug
      const found = await client.query<{ id: string; copied_at: Date | null }>(
        `SELECT id, payload_content_copied_at AS copied_at
         FROM sf_pages WHERE payload_legacy_id = $1 LIMIT 1`,
        [page.id],
      )
      let pageId = found.rows[0]?.id ?? ''
      const needsContent = !found.rows[0] || found.rows[0].copied_at == null
      if (!pageId) {
        const slugOwner = await client.query<{ id: string }>(
          'SELECT id FROM sf_pages WHERE slug = $1 LIMIT 1',
          [slug],
        )
        if (slugOwner.rows[0]) {
          result.pagesSkipped += 1
          continue
        }
        pageId = crypto.randomUUID()
        await client.query(
          `INSERT INTO sf_pages (
             id, slug, status, title, body, meta_title, meta_description, meta_media_id,
             payload_legacy_id, created_at, updated_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            pageId,
            slug,
            asStatus(page.status),
            title,
            fallback.body,
            fallback.metaTitle.slice(0, 300),
            fallback.metaDescription.slice(0, 2000),
            asText(page.meta_media_id).trim().slice(0, 120),
            page.id,
            page.created_at,
            page.updated_at,
          ],
        )
        result.pagesCopied += 1
      } else if (needsContent) {
        await client.query(
          `UPDATE sf_pages SET
             status = $2, title = $3, body = $4, meta_title = $5, meta_description = $6, meta_media_id = $7
           WHERE id = $1 AND payload_content_copied_at IS NULL`,
          [
            pageId,
            asStatus(page.status),
            title,
            fallback.body,
            fallback.metaTitle.slice(0, 300),
            fallback.metaDescription.slice(0, 2000),
            asText(page.meta_media_id).trim().slice(0, 120),
          ],
        )
      }
      if (needsContent) localeJobs.push({ pageId, rows: locales.length > 0 ? locales : [fallback] })

      if (hasPageRels && tagIds.size > 0) {
        const rels = await client.query<{ tags_id: number }>(
          `SELECT tags_id FROM payload.pages_rels
           WHERE parent_id = $1 AND tags_id IS NOT NULL
           ORDER BY "order" NULLS LAST, id`,
          [page.id],
        )
        for (const rel of rels.rows) {
          const tagId = tagIds.get(rel.tags_id)
          if (!tagId) continue
          await client.query(
            `INSERT INTO sf_pages_page_tags (page_id, tag_id) VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [pageId, tagId],
          )
        }
      }
    }

    if (await regclass(client, 'public.sf_pages_versions')) {
      result.versionsCopied += await copyVersions(client, PAGE_VERSION_KEEP)
      await client.query(
        `DELETE FROM sf_pages_versions
         WHERE id IN (
           SELECT id FROM (
             SELECT id, row_number() OVER (PARTITION BY page_id ORDER BY created_at DESC) AS rn
             FROM sf_pages_versions
           ) ranked
           WHERE rn > $1
         )`,
        [PAGE_VERSION_KEEP],
      )
    }

    const legacyRows = await client.query<{ id: string; payload_legacy_id: number }>(
      'SELECT id, payload_legacy_id FROM sf_pages WHERE payload_legacy_id IS NOT NULL',
    )
    const legacyToId = new Map<string, string>()
    for (const row of legacyRows.rows) {
      legacyToId.set(String(row.payload_legacy_id), row.id)
    }
    if (legacyToId.size > 0 && (await regclass(client, 'public.sf_nav_menus'))) {
      const menus = await client.query<{ id: string; document: string }>(
        'SELECT id, document FROM sf_nav_menus',
      )
      for (const menu of menus.rows) {
        let parsed: unknown
        try {
          parsed = JSON.parse(menu.document)
        } catch {
          continue
        }
        const remapped = remapNavDocumentPageIds(parsed, legacyToId)
        if (remapped.changed === 0) continue
        await client.query(
          'UPDATE sf_nav_menus SET document = $2, updated_at = now() WHERE id = $1',
          [menu.id, JSON.stringify(remapped.next)],
        )
        result.navItemsRemapped += remapped.changed
      }
    }

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }

  const stamped: string[] = []
  for (const job of localeJobs) {
    const byLocale = new Map<string, LocaleRow>()
    for (const row of job.rows) byLocale.set(row.locale, row)
    for (const [locale, row] of byLocale) {
      await writeLocaleFile(locale, job.pageId, localeEntries(job.pageId, row))
      result.localesWritten += 1
    }
    stamped.push(job.pageId)
  }
  if (stamped.length > 0) {
    await client.query(
      `UPDATE sf_pages SET payload_content_copied_at = now()
       WHERE id = ANY($1::text[]) AND payload_content_copied_at IS NULL`,
      [stamped],
    )
  }

  return result
}

async function loadPageLocales(
  client: Client,
  pageId: number,
  hasLocales: boolean,
): Promise<LocaleRow[]> {
  if (!hasLocales) return []
  const rows = await client.query<{
    locale: string
    title: string | null
    body: string | null
    meta_title: string | null
    meta_description: string | null
  }>(
    `SELECT _locale::text AS locale, title, body, meta_title, meta_description
     FROM payload.pages_locales WHERE _parent_id = $1`,
    [pageId],
  )
  return rows.rows.map((row) => ({
    locale: asText(row.locale).trim() || DEFAULT_LOCALE,
    title: asText(row.title),
    body: pageBodyToHtml(row.body),
    metaTitle: asText(row.meta_title),
    metaDescription: asText(row.meta_description),
  }))
}

async function copyVersions(client: Client, keep: number): Promise<number> {
  if (!(await regclass(client, 'payload._pages_v'))) return 0
  if (!(await regclass(client, 'public.sf_pages_versions'))) return 0
  const hasAutosave = await columnExists(client, '_pages_v', 'autosave')
  const hasMedia = await columnExists(client, '_pages_v', 'version_meta_media_id')
  const hasVersionLocales = await regclass(client, 'payload._pages_v_locales')
  const autosaveSql = hasAutosave ? 'AND v.autosave IS NOT TRUE' : ''
  const mediaSql = hasMedia ? `COALESCE(v.version_meta_media_id, '')` : `''`
  const versions = await client.query<{
    id: number
    parent_id: number
    slug: string | null
    status: string | null
    created_at: Date
    meta_media_id: string
  }>(
    `SELECT v.id, v.parent_id, v.version_slug AS slug, v.version__status::text AS status,
            v.created_at, ${mediaSql} AS meta_media_id
     FROM payload._pages_v v
     WHERE v.parent_id IS NOT NULL ${autosaveSql}
     ORDER BY v.parent_id, v.created_at DESC`,
  )

  const pages = await client.query<{ id: string; payload_legacy_id: number; slug: string }>(
    'SELECT id, payload_legacy_id, slug FROM sf_pages WHERE payload_legacy_id IS NOT NULL',
  )
  const pageByLegacy = new Map<number, { id: string; slug: string }>()
  for (const row of pages.rows) pageByLegacy.set(row.payload_legacy_id, row)

  const grouped = new Map<number, typeof versions.rows>()
  for (const row of versions.rows) {
    const bucket = grouped.get(row.parent_id) ?? []
    if (bucket.length >= keep) continue
    bucket.push(row)
    grouped.set(row.parent_id, bucket)
  }
  const chosen = [...grouped.values()].flat()
  if (chosen.length === 0) return 0

  const localeByVersion = new Map<number, LocaleRow[]>()
  if (hasVersionLocales) {
    const ids = chosen.map((row) => row.id)
    const localeRows = await client.query<{
      parent_id: number
      locale: string
      title: string | null
      body: string | null
      meta_title: string | null
      meta_description: string | null
    }>(
      `SELECT _parent_id AS parent_id, _locale::text AS locale,
              version_title AS title, version_body AS body,
              version_meta_title AS meta_title, version_meta_description AS meta_description
       FROM payload._pages_v_locales
       WHERE _parent_id = ANY($1::int[])`,
      [ids],
    )
    for (const row of localeRows.rows) {
      const list = localeByVersion.get(row.parent_id) ?? []
      list.push({
        locale: asText(row.locale).trim() || DEFAULT_LOCALE,
        title: asText(row.title),
        body: pageBodyToHtml(row.body),
        metaTitle: asText(row.meta_title),
        metaDescription: asText(row.meta_description),
      })
      localeByVersion.set(row.parent_id, list)
    }
  }

  let copied = 0
  for (const version of chosen) {
    const page = pageByLegacy.get(version.parent_id)
    if (!page) continue
    const exists = await client.query(
      'SELECT 1 FROM sf_pages_versions WHERE payload_legacy_id = $1 LIMIT 1',
      [version.id],
    )
    if (exists.rows.length > 0) continue
    const locales = localeByVersion.get(version.id) ?? []
    const fallback = pickDefault(locales)
    const maps = {
      title: {} as Record<string, string>,
      body: {} as Record<string, string>,
      metaTitle: {} as Record<string, string>,
      metaDescription: {} as Record<string, string>,
    }
    for (const row of locales) {
      if (row.title.trim()) maps.title[row.locale] = row.title
      if (row.body.trim()) maps.body[row.locale] = row.body
      if (row.metaTitle.trim()) maps.metaTitle[row.locale] = row.metaTitle
      if (row.metaDescription.trim()) maps.metaDescription[row.locale] = row.metaDescription
    }
    await client.query(
      `INSERT INTO sf_pages_versions (
         id, page_id, payload_legacy_id, title, body, meta_title, meta_description,
         meta_media_id, slug, status, tags, locales, created_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'',$11::jsonb,$12)`,
      [
        crypto.randomUUID(),
        page.id,
        version.id,
        (fallback?.title ?? '').slice(0, 300),
        fallback?.body ?? '',
        (fallback?.metaTitle ?? '').slice(0, 300),
        (fallback?.metaDescription ?? '').slice(0, 2000),
        asText(version.meta_media_id).slice(0, 120),
        asText(version.slug).trim() || page.slug,
        asStatus(asText(version.status)),
        JSON.stringify(maps),
        version.created_at,
      ],
    )
    copied += 1
  }
  return copied
}
