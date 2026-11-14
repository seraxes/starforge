import 'server-only'

import { getPayload } from 'payload'

import config from '@payload-config'

import {
  STARFORGE_PIPELINE_APPLIED,
  applyMediaPipelineRules,
} from './apply-pipeline'
import { ensureLegacyCategoryRoots, resolveFolderForCategory } from './category-store'
import {
  normalizeMediaFolder,
  normalizeMediaPurpose,
} from './pipeline'
import { toResolvedMedia, type ResolvedMedia } from './resolve'
import { getMediaPipelineRules } from './settings-store'

export type IngestImageInput = {
  file: File
  /** Alt text; falls back to the filename. */
  alt?: string
  /** Nested Categories id from the picker (`all` / empty = none). */
  categoryRaw?: string
  /** Legacy flat folder slug. */
  folderRaw?: string
  purpose?: string
  /** Shared Tags id. */
  tagRaw?: string
  /** Convert photo originals to WebP (default true). Callers must clamp via encode policy. */
  decodeToWebp?: boolean
  /** Cap longest edge (default true). Callers must clamp via encode policy. */
  resize?: boolean
}

export type IngestImageResult = {
  id: string
  media: ResolvedMedia | null
}

/**
 * Authorization-free image ingest — runs the shared Media pipeline and writes the
 * Payload `media` doc. Callers (admin library, member uploads) own the auth,
 * rate-limit and size checks; this stays one pipeline for every uploader.
 * Throws on pipeline / storage failure.
 */
export async function ingestImageUpload(
  input: IngestImageInput,
): Promise<IngestImageResult> {
  const { file } = input
  const alt =
    (input.alt ?? '').trim() || file.name.replace(/\.[^.]+$/, '') || 'Image'
  const categoryRaw = (input.categoryRaw ?? '').trim()
  const folderRaw = (input.folderRaw ?? '').trim()
  const purpose = normalizeMediaPurpose(input.purpose ?? 'photo')
  const tagRaw = (input.tagRaw ?? '').trim()

  const payload = await getPayload({ config })
  await ensureLegacyCategoryRoots()

  let categoryId: number | null = null
  if (categoryRaw && categoryRaw !== 'all') {
    const n = Number(categoryRaw)
    if (Number.isFinite(n)) categoryId = n
  }

  const folder = categoryId
    ? await resolveFolderForCategory(String(categoryId))
    : normalizeMediaFolder(folderRaw || 'general')

  // If only legacy folder was posted (picker defaultFolder), map onto category when possible.
  if (!categoryId && folderRaw) {
    const bySlug = await payload.find({
      collection: 'categories',
      where: { slug: { equals: normalizeMediaFolder(folderRaw) } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (bySlug.docs[0]) categoryId = Number(bySlug.docs[0].id)
  }

  const raw = Buffer.from(await file.arrayBuffer())
  const rules = await getMediaPipelineRules()
  const processed = await applyMediaPipelineRules({
    buffer: raw,
    mimeType: file.type,
    purpose,
    rules,
    decodeToWebp: input.decodeToWebp !== false,
    resize: input.resize !== false,
  })
  let name = file.name || `upload-${Date.now()}.jpg`
  if (processed.extHint) {
    name = name.replace(/\.[^.]+$/, '') + `.${processed.extHint}`
  }

  const tagId = tagRaw ? Number(tagRaw) : NaN
  const doc = await payload.create({
    collection: 'media',
    data: {
      alt,
      folder,
      purpose,
      ...(categoryId != null && Number.isFinite(categoryId) ? { category: categoryId } : {}),
      ...(Number.isFinite(tagId) ? { tags: [tagId] } : {}),
    },
    file: {
      data: processed.data,
      mimetype: processed.mimetype,
      name,
      size: processed.data.length,
    },
    context: { [STARFORGE_PIPELINE_APPLIED]: true },
    overrideAccess: true,
  })

  const media = toResolvedMedia(doc as Parameters<typeof toResolvedMedia>[0], {
    size: 'thumbnail',
    preferWebp: true,
  })
  return { id: String(doc.id), media }
}
