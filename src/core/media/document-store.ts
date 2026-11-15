/**
 * product:media document store. Drizzle SQL against `sf_media_*`.
 * Table declarations live in `src/modules/media/schema.ts` (pack-owned).
 * This file does not import the pack — Core must not cross that boundary.
 * Blobs go through MediaStorage.
 */

import 'server-only'

import { randomUUID } from 'node:crypto'

import { sql, type SQL } from 'drizzle-orm'

import { db } from '@/core/db'

import type { MediaDoc, MediaSizesJson } from './media-record'

type QueryResult<T> = { rows: T[] }

async function q<T>(query: SQL): Promise<T[]> {
  const result = (await db.execute(query)) as QueryResult<T>
  return result.rows ?? []
}

function textId(): string {
  return randomUUID()
}

function asInt(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

function asSizes(value: unknown): MediaSizesJson | null {
  if (value == null) return null
  if (typeof value === 'string') {
    try {
      return asSizes(JSON.parse(value))
    } catch {
      return null
    }
  }
  if (typeof value === 'object') return value as MediaSizesJson
  return null
}

type AssetRow = {
  id: string
  alt: string | null
  mime_type: string | null
  filename: string | null
  filesize: number | string | null
  width: number | string | null
  height: number | string | null
  purpose: string | null
  folder: string | null
  private: boolean | null
  category_id: string | null
  category_title: string | null
  category_path: string | null
  url: string | null
  path: string | null
  sizes: unknown
}

const ASSET_SELECT = sql`
  a.id,
  a.alt,
  a.mime_type,
  a.filename,
  a.filesize,
  a.width,
  a.height,
  a.purpose,
  a.folder,
  a.private,
  a.category_id,
  c.title AS category_title,
  c.path AS category_path,
  a.url,
  a.path,
  a.sizes
`

function mapAsset(row: AssetRow): MediaDoc {
  const pathLabel =
    typeof row.category_path === 'string' && row.category_path.trim()
      ? row.category_path.trim()
      : ''
  const title =
    typeof row.category_title === 'string' && row.category_title.trim()
      ? row.category_title.trim()
      : ''
  return {
    id: String(row.id),
    alt: row.alt ?? '',
    mimeType: row.mime_type,
    filename: row.filename,
    filesize: asInt(row.filesize),
    width: asInt(row.width),
    height: asInt(row.height),
    purpose: row.purpose,
    folder: row.folder,
    private: row.private === true,
    categoryId: row.category_id,
    categoryLabel: pathLabel || title || null,
    url: row.url,
    path: row.path,
    sizes: asSizes(row.sizes),
    tagIds: [],
    tagLabels: [],
  }
}

async function attachTags(docs: MediaDoc[]): Promise<void> {
  if (!docs.length) return
  const inList = sql.join(
    docs.map((doc) => sql`${doc.id}`),
    sql`, `,
  )
  const rows = await q<{ asset_id: string; id: string; title: string | null }>(sql`
    SELECT j.asset_id, t.id, t.title
    FROM sf_media_asset_tags j
    JOIN sf_media_tags t ON t.id = j.tag_id
    WHERE j.asset_id IN (${inList})
    ORDER BY t.title ASC
  `)
  const by = new Map<string, { ids: string[]; labels: string[] }>()
  for (const row of rows) {
    const slot = by.get(row.asset_id) ?? { ids: [], labels: [] }
    slot.ids.push(String(row.id))
    if (row.title && row.title.trim()) slot.labels.push(row.title.trim())
    by.set(row.asset_id, slot)
  }
  for (const doc of docs) {
    const slot = by.get(doc.id)
    doc.tagIds = slot?.ids ?? []
    doc.tagLabels = slot?.labels ?? []
  }
}

async function loadAssets(where: SQL, extra?: SQL): Promise<MediaDoc[]> {
  const rows = await q<AssetRow>(sql`
    SELECT ${ASSET_SELECT}
    FROM sf_media_assets a
    LEFT JOIN sf_media_categories c ON c.id = a.category_id
    WHERE ${where}
    ${extra ?? sql``}
  `)
  const docs = rows.map(mapAsset)
  await attachTags(docs)
  return docs
}

export async function getMediaAsset(id: string): Promise<MediaDoc | null> {
  const raw = id.trim()
  if (!raw) return null
  const docs = await loadAssets(sql`a.id = ${raw}`, sql`LIMIT 1`)
  return docs[0] ?? null
}

export type MediaWriteFile = {
  filename: string
  path: string
  url: string
  mimeType: string
  filesize: number
  width: number | null
  height: number | null
  sizes: MediaSizesJson | null
}

export type InsertMediaAssetInput = {
  alt: string
  purpose: string
  folder: string
  categoryId: string | null
  isPrivate: boolean
  tagIds?: string[]
  file: MediaWriteFile
}

export async function insertMediaAsset(input: InsertMediaAssetInput): Promise<MediaDoc> {
  const id = textId()
  const sizes = input.file.sizes ? JSON.stringify(input.file.sizes) : null
  const tagIds = await existingTagIds(input.tagIds ?? [])
  await db.transaction(async (tx) => {
    await tx.execute(sql`
      INSERT INTO sf_media_assets (
        id, alt, mime_type, filename, filesize, width, height,
        purpose, folder, private, category_id, url, path, sizes
      ) VALUES (
        ${id},
        ${input.alt},
        ${input.file.mimeType},
        ${input.file.filename},
        ${input.file.filesize},
        ${input.file.width},
        ${input.file.height},
        ${input.purpose},
        ${input.folder},
        ${input.isPrivate},
        ${input.categoryId},
        ${input.file.url},
        ${input.file.path},
        ${sizes}::jsonb
      )
    `    )
    for (const tagId of tagIds) {
      await tx.execute(sql`
        INSERT INTO sf_media_asset_tags (asset_id, tag_id)
        VALUES (${id}, ${tagId})
        ON CONFLICT DO NOTHING
      `)
    }
  })
  const doc = await getMediaAsset(id)
  if (!doc) throw new Error('Saved media but failed to reload it.')
  return doc
}

export async function replaceMediaAssetFile(
  id: string,
  file: MediaWriteFile,
): Promise<MediaDoc | null> {
  const sizes = file.sizes ? JSON.stringify(file.sizes) : null
  const updated = await q<{ id: string }>(sql`
    UPDATE sf_media_assets
    SET mime_type = ${file.mimeType},
        filename = ${file.filename},
        filesize = ${file.filesize},
        width = ${file.width},
        height = ${file.height},
        url = ${file.url},
        path = ${file.path},
        sizes = ${sizes}::jsonb,
        updated_at = now()
    WHERE id = ${id}
    RETURNING id
  `)
  if (!updated.length) return null
  return getMediaAsset(id)
}

export async function updateMediaAssetDetails(input: {
  id: string
  alt: string
  purpose: string
  categoryId: string | null
  /** When set, also write the legacy folder slug. Omit to leave it. */
  folder?: string
  isPrivate: boolean
  tagIds: string[]
}): Promise<MediaDoc | null> {
  const tagIds = await existingTagIds(input.tagIds)
  await db.transaction(async (tx) => {
    if (input.folder !== undefined) {
      await tx.execute(sql`
        UPDATE sf_media_assets
        SET alt = ${input.alt},
            purpose = ${input.purpose},
            category_id = ${input.categoryId},
            folder = ${input.folder},
            private = ${input.isPrivate},
            updated_at = now()
        WHERE id = ${input.id}
      `)
    } else {
      await tx.execute(sql`
        UPDATE sf_media_assets
        SET alt = ${input.alt},
            purpose = ${input.purpose},
            category_id = ${input.categoryId},
            private = ${input.isPrivate},
            updated_at = now()
        WHERE id = ${input.id}
      `)
    }
    await tx.execute(sql`DELETE FROM sf_media_asset_tags WHERE asset_id = ${input.id}`)
    for (const tagId of tagIds) {
      await tx.execute(sql`
        INSERT INTO sf_media_asset_tags (asset_id, tag_id)
        VALUES (${input.id}, ${tagId})
        ON CONFLICT DO NOTHING
      `)
    }
  })
  return getMediaAsset(input.id)
}

export async function addMediaAssetTag(assetId: string, tagId: string): Promise<void> {
  const known = await existingTagIds([tagId])
  if (!known.length) return
  await q(sql`
    INSERT INTO sf_media_asset_tags (asset_id, tag_id)
    VALUES (${assetId}, ${known[0]})
    ON CONFLICT DO NOTHING
  `)
}

export async function setMediaAssetCategory(input: {
  id: string
  categoryId: string | null
  folder: string
}): Promise<void> {
  await q(sql`
    UPDATE sf_media_assets
    SET category_id = ${input.categoryId},
        folder = ${input.folder},
        updated_at = now()
    WHERE id = ${input.id}
  `)
}

export async function deleteMediaAsset(id: string): Promise<MediaDoc | null> {
  const existing = await getMediaAsset(id)
  if (!existing) return null
  await db.transaction(async (tx) => {
    await tx.execute(sql`DELETE FROM sf_media_asset_tags WHERE asset_id = ${id}`)
    await tx.execute(sql`DELETE FROM sf_media_owners WHERE media_id = ${id}`)
    await tx.execute(sql`DELETE FROM sf_media_assets WHERE id = ${id}`)
  })
  return existing
}

function likePattern(raw: string): string {
  const escaped = raw.replace(/[\\%_]/g, (ch) => `\\${ch}`)
  return `%${escaped}%`
}

export async function listMediaAssets(opts: {
  category?: string
  folder?: string
  purpose?: string
  tagIds?: string[]
  tagMode?: 'and' | 'or'
  q?: string
  limit: number
  offset: number
}): Promise<{ docs: MediaDoc[]; total: number }> {
  const parts: SQL[] = [sql`TRUE`]
  const category = (opts.category ?? '').trim()
  const folder = (opts.folder ?? '').trim()
  const purpose = (opts.purpose ?? '').trim()
  const qtext = (opts.q ?? '').trim()
  const tagIds = (opts.tagIds ?? []).map((id) => id.trim()).filter(Boolean)

  if (category && category !== 'all') {
    parts.push(sql`a.category_id = ${category}`)
  } else if (folder && folder !== 'all') {
    parts.push(sql`a.folder = ${folder}`)
  }
  if (purpose && purpose !== 'all') {
    parts.push(sql`a.purpose = ${purpose}`)
  }
  if (qtext) {
    const pattern = likePattern(qtext)
    parts.push(sql`(a.alt ILIKE ${pattern} ESCAPE '\\' OR a.filename ILIKE ${pattern} ESCAPE '\\')`)
  }
  if (tagIds.length) {
    const inList = sql.join(
      tagIds.map((id) => sql`${id}`),
      sql`, `,
    )
    if (opts.tagMode === 'and' && tagIds.length > 1) {
      parts.push(sql`(
        SELECT COUNT(DISTINCT j.tag_id)::int
        FROM sf_media_asset_tags j
        WHERE j.asset_id = a.id AND j.tag_id IN (${inList})
      ) = ${tagIds.length}`)
    } else {
      parts.push(sql`EXISTS (
        SELECT 1 FROM sf_media_asset_tags j
        WHERE j.asset_id = a.id AND j.tag_id IN (${inList})
      )`)
    }
  }

  const where = sql.join(parts, sql` AND `)
  const countRows = await q<{ n: number }>(sql`
    SELECT COUNT(*)::int AS n
    FROM sf_media_assets a
    WHERE ${where}
  `)
  const total = Number(countRows[0]?.n ?? 0)
  const docs = await loadAssets(
    where,
    sql`ORDER BY a.created_at DESC LIMIT ${opts.limit} OFFSET ${opts.offset}`,
  )
  return { docs, total }
}

async function existingTagIds(ids: string[]): Promise<string[]> {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))]
  if (!unique.length) return []
  const inList = sql.join(
    unique.map((id) => sql`${id}`),
    sql`, `,
  )
  const rows = await q<{ id: string }>(sql`
    SELECT id FROM sf_media_tags WHERE id IN (${inList})
  `)
  const known = new Set(rows.map((row) => String(row.id)))
  return unique.filter((id) => known.has(id))
}

export async function claimMediaKey(preferred: string, reserved: Set<string>): Promise<string> {
  const clean = preferred.trim()
  if (!clean || clean.includes('/') || clean.includes('\\') || clean.includes('..')) {
    throw new Error('Invalid media filename.')
  }
  const dot = clean.lastIndexOf('.')
  const stem = (dot > 0 ? clean.slice(0, dot) : clean).slice(0, 80) || 'file'
  const ext = dot > 0 ? clean.slice(dot).slice(0, 16) : ''
  for (let n = 0; n < 40; n += 1) {
    const candidate = n === 0 ? `${stem}${ext}` : `${stem}-${n + 1}${ext}`
    if (reserved.has(candidate)) continue
    const taken = await q<{ ok: number }>(sql`
      SELECT 1 AS ok FROM sf_media_assets
      WHERE filename = ${candidate}
         OR path = ${candidate}
         OR sizes->'thumbnail'->>'path' = ${candidate}
         OR sizes->'thumbnail'->>'filename' = ${candidate}
         OR sizes->'card'->>'path' = ${candidate}
         OR sizes->'card'->>'filename' = ${candidate}
         OR sizes->'large'->>'path' = ${candidate}
         OR sizes->'large'->>'filename' = ${candidate}
      LIMIT 1
    `)
    if (!taken.length) {
      reserved.add(candidate)
      return candidate
    }
  }
  const fallback = `${stem}-${randomUUID()}${ext}`
  reserved.add(fallback)
  return fallback
}

export type ServedObject = {
  key: string
  mimeType: string | null
  filename: string | null
  folder: string | null
  isPrivate: boolean
}

/** Resolve a public file URL basename to the stored object. */
export async function findStoredObjectByKey(key: string): Promise<ServedObject | null> {
  const raw = key.trim()
  if (!raw) return null
  const rows = await q<{
    path: string | null
    filename: string | null
    mime_type: string | null
    folder: string | null
    private: boolean | null
    sizes: unknown
  }>(sql`
    SELECT a.path, a.filename, a.mime_type, a.folder, a.private, a.sizes
    FROM sf_media_assets a
    WHERE a.filename = ${raw}
       OR a.path = ${raw}
       OR a.sizes->'thumbnail'->>'filename' = ${raw}
       OR a.sizes->'thumbnail'->>'path' = ${raw}
       OR a.sizes->'card'->>'filename' = ${raw}
       OR a.sizes->'card'->>'path' = ${raw}
       OR a.sizes->'large'->>'filename' = ${raw}
       OR a.sizes->'large'->>'path' = ${raw}
    LIMIT 1
  `)
  const row = rows[0]
  if (!row) return null
  const sizes = asSizes(row.sizes)
  let serveKey = row.path || row.filename || raw
  let mime = row.mime_type
  const names = ['thumbnail', 'card', 'large'] as const
  for (const name of names) {
    const entry = sizes?.[name]
    if (!entry) continue
    if (entry.filename === raw || entry.path === raw) {
      serveKey = entry.path || entry.filename || serveKey
      mime = entry.mimeType || 'image/webp'
    }
  }
  if (row.filename === raw || row.path === raw) {
    serveKey = row.path || row.filename || raw
    mime = row.mime_type
  }
  return {
    key: serveKey,
    mimeType: mime,
    filename: row.filename,
    folder: row.folder,
    isPrivate: row.private === true,
  }
}

export type CategoryRow = {
  id: string
  title: string
  slug: string
  parentId: string | null
  path: string
  depth: number
}

function mapCategory(row: {
  id: string
  title: string | null
  slug: string | null
  parent_id: string | null
  path: string | null
  depth: number | string | null
}): CategoryRow {
  return {
    id: String(row.id),
    title: row.title?.trim() || String(row.id),
    slug: row.slug ?? '',
    parentId: row.parent_id,
    path: row.path ?? '',
    depth: asInt(row.depth) ?? 0,
  }
}

export async function listCategoryRows(): Promise<CategoryRow[]> {
  const rows = await q<{
    id: string
    title: string | null
    slug: string | null
    parent_id: string | null
    path: string | null
    depth: number | string | null
  }>(sql`
    SELECT id, title, slug, parent_id, path, depth
    FROM sf_media_categories
    ORDER BY title ASC
    LIMIT 500
  `)
  return rows.map(mapCategory)
}

export async function getCategoryRow(id: string): Promise<CategoryRow | null> {
  const raw = id.trim()
  if (!raw) return null
  const rows = await q<{
    id: string
    title: string | null
    slug: string | null
    parent_id: string | null
    path: string | null
    depth: number | string | null
  }>(sql`
    SELECT id, title, slug, parent_id, path, depth
    FROM sf_media_categories
    WHERE id = ${raw}
    LIMIT 1
  `)
  return rows[0] ? mapCategory(rows[0]) : null
}

export async function getCategoryBySlug(slug: string): Promise<CategoryRow | null> {
  const raw = slug.trim()
  if (!raw) return null
  const rows = await q<{
    id: string
    title: string | null
    slug: string | null
    parent_id: string | null
    path: string | null
    depth: number | string | null
  }>(sql`
    SELECT id, title, slug, parent_id, path, depth
    FROM sf_media_categories
    WHERE slug = ${raw}
    LIMIT 1
  `)
  return rows[0] ? mapCategory(rows[0]) : null
}

export async function insertCategoryRow(input: {
  title: string
  slug: string
  parentId: string | null
  path: string
  depth: number
}): Promise<CategoryRow> {
  const id = textId()
  await q(sql`
    INSERT INTO sf_media_categories (id, title, slug, parent_id, path, depth)
    VALUES (${id}, ${input.title}, ${input.slug}, ${input.parentId}, ${input.path}, ${input.depth})
  `)
  const row = await getCategoryRow(id)
  if (!row) throw new Error('Created folder but failed to reload.')
  return row
}

export async function updateCategoryPath(id: string, pathValue: string, title: string): Promise<void> {
  await q(sql`
    UPDATE sf_media_categories
    SET title = ${title}, path = ${pathValue}, updated_at = now()
    WHERE id = ${id}
  `)
}

export async function updateCategoryPathOnly(id: string, pathValue: string): Promise<void> {
  await q(sql`
    UPDATE sf_media_categories
    SET path = ${pathValue}, updated_at = now()
    WHERE id = ${id}
  `)
}

export async function deleteCategoryRow(id: string): Promise<void> {
  await q(sql`DELETE FROM sf_media_categories WHERE id = ${id}`)
}

export async function countChildCategories(id: string): Promise<number> {
  const rows = await q<{ n: number }>(sql`
    SELECT COUNT(*)::int AS n FROM sf_media_categories WHERE parent_id = ${id}
  `)
  return Number(rows[0]?.n ?? 0)
}

export async function countAssetsInCategory(id: string): Promise<number> {
  const rows = await q<{ n: number }>(sql`
    SELECT COUNT(*)::int AS n FROM sf_media_assets WHERE category_id = ${id}
  `)
  return Number(rows[0]?.n ?? 0)
}

export type TagRow = {
  id: string
  title: string
  slug: string
}

export async function listTagRows(): Promise<TagRow[]> {
  const rows = await q<{ id: string; title: string | null; slug: string | null }>(sql`
    SELECT id, title, slug
    FROM sf_media_tags
    ORDER BY title ASC
    LIMIT 500
  `)
  return rows.map((row) => ({
    id: String(row.id),
    title: row.title?.trim() || String(row.id),
    slug: row.slug ?? '',
  }))
}

export async function getTagBySlug(slug: string): Promise<TagRow | null> {
  const rows = await q<{ id: string; title: string | null; slug: string | null }>(sql`
    SELECT id, title, slug FROM sf_media_tags WHERE slug = ${slug} LIMIT 1
  `)
  const row = rows[0]
  if (!row) return null
  return { id: String(row.id), title: row.title?.trim() || String(row.id), slug: row.slug ?? '' }
}

export async function insertTagRow(input: { title: string; slug: string }): Promise<TagRow> {
  const id = textId()
  await q(sql`
    INSERT INTO sf_media_tags (id, title, slug)
    VALUES (${id}, ${input.title}, ${input.slug})
  `)
  return { id, title: input.title, slug: input.slug }
}

export async function renameTagRow(id: string, title: string): Promise<boolean> {
  const rows = await q<{ id: string }>(sql`
    UPDATE sf_media_tags
    SET title = ${title}, updated_at = now()
    WHERE id = ${id}
    RETURNING id
  `)
  return rows.length > 0
}
