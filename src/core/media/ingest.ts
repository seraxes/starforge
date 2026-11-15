import 'server-only'

import { randomUUID } from 'node:crypto'

import {
  claimMediaKey,
  deleteMediaAsset,
  getMediaAsset,
  insertMediaAsset,
  replaceMediaAssetFile,
  type MediaWriteFile,
} from './document-store'
import { readImageSize, renderMediaDerivatives, sizesFromStored } from './derivatives'
import { ensureLegacyCategoryRoots, getCategoryBySlug, resolveFolderForCategory } from './category-store'
import { applyMediaPipelineRules } from './apply-pipeline'
import { normalizeMediaFolder, normalizeMediaPurpose } from './pipeline'
import { toResolvedMedia, type ResolvedMedia } from './resolve'
import { getMediaPipelineRules } from './settings-store'
import { getMediaStorage } from './storage'

export type IngestImageInput = {
  file: File
  /** Alt text; falls back to the filename. */
  alt?: string
  /** Nested category id from the picker (`all` / empty = none). */
  categoryRaw?: string
  /** Legacy flat folder slug. */
  folderRaw?: string
  purpose?: string
  /** Media-tag id. */
  tagRaw?: string
  /** Convert photo originals to WebP (default true). Callers must clamp via encode policy. */
  decodeToWebp?: boolean
  /** Cap longest edge (default true). Callers must clamp via encode policy. */
  resize?: boolean
  /** Form respondent uploads. Skips the public library and marks the row private. */
  formAttachment?: boolean
}

export type IngestImageResult = {
  id: string
  media: ResolvedMedia | null
}

function stemOf(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, '')
  return base || 'upload'
}

async function storeProcessedFile(input: {
  buffer: Buffer
  mimeType: string
  filename: string
  purpose: string
  visibility: 'public' | 'private'
}): Promise<MediaWriteFile> {
  const rules = await getMediaPipelineRules()
  const storage = getMediaStorage()
  const reserved = new Set<string>()
  const filename = await claimMediaKey(input.filename, reserved)
  const original = await storage.put({
    key: filename,
    body: input.buffer,
    mimeType: input.mimeType,
    visibility: input.visibility,
  })
  const { width, height } = await readImageSize(input.buffer, input.mimeType)
  const rendered = await renderMediaDerivatives({
    buffer: input.buffer,
    mimeType: input.mimeType,
    basename: stemOf(filename),
    rules,
  })
  const storedSizes = []
  for (const derivative of rendered) {
    const key = await claimMediaKey(derivative.filename, reserved)
    const put = await storage.put({
      key,
      body: derivative.buffer,
      mimeType: derivative.mimeType,
      visibility: input.visibility,
    })
    storedSizes.push({
      name: derivative.name,
      url: put.url,
      path: put.key,
      filename: put.key,
      width: derivative.width,
      height: derivative.height,
      mimeType: derivative.mimeType,
      filesize: derivative.buffer.length,
    })
  }
  return {
    filename,
    path: original.key,
    url: original.url,
    mimeType: input.mimeType,
    filesize: input.buffer.length,
    width,
    height,
    sizes: sizesFromStored(storedSizes),
  }
}

function storageKeysOf(doc: {
  path: string | null
  sizes: { thumbnail?: { path?: string | null }; card?: { path?: string | null }; large?: { path?: string | null } } | null
}): string[] {
  const keys: string[] = []
  if (doc.path) keys.push(doc.path)
  for (const name of ['thumbnail', 'card', 'large'] as const) {
    const key = doc.sizes?.[name]?.path
    if (key) keys.push(key)
  }
  return keys
}

/**
 * Authorization-free ingest — runs the shared Media pipeline and writes
 * `sf_media_assets` plus blobs on MediaStorage. Callers own auth and limits.
 */
export async function ingestImageUpload(input: IngestImageInput): Promise<IngestImageResult> {
  const { file } = input
  const alt = (input.alt ?? '').trim() || file.name.replace(/\.[^.]+$/, '') || 'Image'
  const categoryRaw = (input.categoryRaw ?? '').trim()
  const folderRaw = (input.folderRaw ?? '').trim()
  const purpose = normalizeMediaPurpose(input.purpose ?? (input.formAttachment ? 'other' : 'photo'))
  const tagRaw = (input.tagRaw ?? '').trim()

  await ensureLegacyCategoryRoots()

  let categoryId: string | null = null
  if (categoryRaw && categoryRaw !== 'all') categoryId = categoryRaw

  let folder = categoryId
    ? await resolveFolderForCategory(categoryId)
    : normalizeMediaFolder(folderRaw || (input.formAttachment ? 'forms' : 'general'))

  if (!categoryId && folderRaw) {
    const bySlug = await getCategoryBySlug(normalizeMediaFolder(folderRaw))
    if (bySlug) {
      categoryId = bySlug.id
      folder = await resolveFolderForCategory(categoryId)
    }
  }

  if (input.formAttachment && !categoryId) {
    const forms = await getCategoryBySlug('forms')
    if (forms) categoryId = forms.id
    folder = normalizeMediaFolder('forms')
  }

  const raw = Buffer.from(await file.arrayBuffer())
  const rules = await getMediaPipelineRules()
  const processed = await applyMediaPipelineRules({
    buffer: raw,
    mimeType: file.type || 'application/octet-stream',
    purpose,
    rules,
    decodeToWebp: input.decodeToWebp !== false,
    resize: input.resize !== false,
  })
  let name = file.name || `upload-${Date.now()}`
  if (processed.extHint) {
    name = name.replace(/\.[^.]+$/, '') + `.${processed.extHint}`
  }
  name = name.replace(/[^\w.\-]+/g, '-').replace(/-+/g, '-').slice(0, 120) || `upload-${randomUUID()}`

  const stored = await storeProcessedFile({
    buffer: processed.data,
    mimeType: processed.mimetype,
    filename: name,
    purpose,
    visibility: input.formAttachment ? 'private' : 'public',
  })

  const doc = await insertMediaAsset({
    alt,
    purpose,
    folder,
    categoryId,
    isPrivate: input.formAttachment === true,
    tagIds: tagRaw ? [tagRaw] : [],
    file: stored,
  })
  return { id: doc.id, media: toResolvedMedia(doc, { size: 'thumbnail', preferWebp: true }) }
}

export type ReplaceMediaFileInput = {
  id: string
  file: File
  /** Convert photo originals to WebP (default true). Ignored for non-images. */
  decodeToWebp?: boolean
  /** Cap longest edge (default true). Ignored for non-images. */
  resize?: boolean
}

/**
 * Replace the file on an existing asset. Runs the same sharp rules as ingest
 * and regenerates thumbnail / card / large. Metadata stays on the same id.
 */
export async function replaceMediaFile(input: ReplaceMediaFileInput): Promise<IngestImageResult> {
  const id = input.id.trim()
  if (!id) throw new Error('Missing media id.')
  const existing = await getMediaAsset(id)
  if (!existing) throw new Error('Media not found.')

  const { file } = input
  const purpose = normalizeMediaPurpose(existing.purpose)
  const raw = Buffer.from(await file.arrayBuffer())
  const rules = await getMediaPipelineRules()
  const processed = await applyMediaPipelineRules({
    buffer: raw,
    mimeType: file.type || existing.mimeType || 'application/octet-stream',
    purpose,
    rules,
    decodeToWebp: input.decodeToWebp !== false,
    resize: input.resize !== false,
  })
  let name = file.name || existing.filename || `upload-${Date.now()}`
  if (processed.extHint) {
    name = name.replace(/\.[^.]+$/, '') + `.${processed.extHint}`
  }
  name = name.replace(/[^\w.\-]+/g, '-').replace(/-+/g, '-').slice(0, 120) || `upload-${randomUUID()}`

  const stored = await storeProcessedFile({
    buffer: processed.data,
    mimeType: processed.mimetype,
    filename: name,
    purpose,
    visibility: existing.private || existing.folder === 'forms' ? 'private' : 'public',
  })
  const doc = await replaceMediaAssetFile(id, stored)
  if (!doc) throw new Error('Media not found.')

  const storage = getMediaStorage()
  const nextKeys = new Set(storageKeysOf(doc))
  for (const key of storageKeysOf(existing)) {
    if (nextKeys.has(key)) continue
    try {
      await storage.delete(key)
    } catch {
      // The new file is already the row. A leftover blob is not a failed replace.
    }
  }

  return {
    id: doc.id,
    media: toResolvedMedia(doc, { size: 'thumbnail', preferWebp: true }),
  }
}

/** Delete the document row, member ledger entry, and stored blobs. */
export async function removeMediaAsset(id: string): Promise<void> {
  const existing = await deleteMediaAsset(id)
  if (!existing) return
  const storage = getMediaStorage()
  for (const key of storageKeysOf(existing)) {
    try {
      await storage.delete(key)
    } catch {
      // Row is already gone.
    }
  }
}
