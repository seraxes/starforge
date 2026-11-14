'use server'

import { revalidatePath } from '@/core/content/defer-revalidate'
import { getPayload } from 'payload'

import config from '@payload-config'
import { requireAppAdmin } from '@/core/auth/admin'

import { getMediaAnalysisPort } from './analysis'
import type { MediaAnalysisResult } from './analysis/types'
import { STARFORGE_PIPELINE_APPLIED } from './apply-pipeline'
import type { MediaCategoryNode } from './categories'
import {
  createMediaCategory,
  deleteMediaCategory,
  ensureLegacyCategoryRoots,
  listMediaCategoryTree,
  renameMediaCategory,
  resolveFolderForCategory,
} from './category-store'
import { resolvePostedMediaEncodeFlags, getMediaEncodePolicy } from './encode-policy'
import { ingestImageUpload } from './ingest'
import {
  mediaSuggestionPatchIsEmpty,
  mergeMediaAnalysisSuggestions,
  parseMediaBulkIds,
  type MediaSuggestionPatch,
} from './library-query'
import {
  isMediaEncodeGroupMode,
  normalizeMediaEncodeGroupMap,
  normalizeMediaPipelineRules,
  normalizeMediaPurpose,
  type MediaEncodeGroupMode,
  type MediaEncodePolicy,
  type MediaFolder,
  type MediaPipelineRules,
  type MediaPurpose,
} from './pipeline'
import {
  listMedia,
  listMediaTagOptions,
  toResolvedMedia,
  type MediaTagOption,
  type ResolvedMedia,
} from './resolve'
import { getMediaPipelineRules, saveMediaPipelineRules } from './settings-store'
import { getMediaStorageInfo } from './storage'

export type MediaActionState = {
  error?: string
  ok?: boolean
  message?: string
  media?: ResolvedMedia
  /** Analyze action — raw port results for UI. */
  analysis?: MediaAnalysisResult[]
  /** Merged suggestions awaiting confirm. */
  suggestions?: MediaSuggestionPatch
  /** Bulk delete/move/tag counts. */
  affected?: number
}

async function requireMediaAdmin(): Promise<MediaActionState | null> {
  const admin = await requireAppAdmin()
  if (!admin) {
    return { error: 'Sign in as a Starforge app admin to manage media.' }
  }
  const storage = getMediaStorageInfo()
  if (!storage.ready) {
    return {
      error: storage.detail || 'Media storage is not ready. Use local disk storage.',
    }
  }
  return null
}

export async function listMediaAction(input?: {
  category?: string
  folder?: string
  purpose?: string
  tag?: string
  tagMode?: string
  q?: string
  limit?: number
  page?: number
}): Promise<{ error?: string; result?: Awaited<ReturnType<typeof listMedia>> }> {
  const denied = await requireMediaAdmin()
  if (denied) return { error: denied.error }

  try {
    const result = await listMedia(input)
    return { result }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to list media.' }
  }
}

/** Shared Tags options for MediaPicker / library facets. */
export async function listMediaTagOptionsAction(): Promise<{
  error?: string
  tags?: MediaTagOption[]
}> {
  const denied = await requireMediaAdmin()
  if (denied) return { error: denied.error }

  try {
    const tags = await listMediaTagOptions()
    return { tags }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to list tags.' }
  }
}

/** Nested Categories tree for Media library sidebar / picker. */
export async function listMediaCategoryTreeAction(): Promise<{
  error?: string
  tree?: MediaCategoryNode[]
}> {
  const denied = await requireMediaAdmin()
  if (denied) return { error: denied.error }

  try {
    await ensureLegacyCategoryRoots()
    const tree = await listMediaCategoryTree()
    return { tree }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to list folders.' }
  }
}

export async function createMediaCategoryAction(
  _prev: MediaActionState,
  formData: FormData,
): Promise<MediaActionState> {
  const denied = await requireMediaAdmin()
  if (denied) return denied

  const title = String(formData.get('title') ?? '').trim()
  const parentId = String(formData.get('parentId') ?? '').trim()
  const result = await createMediaCategory({
    title,
    parentId: parentId && parentId !== 'all' ? parentId : null,
  })
  if (result.error) return { error: result.error }
  revalidatePath('/admin/media')
  return { ok: true, message: 'Folder created.' }
}

export async function renameMediaCategoryAction(
  _prev: MediaActionState,
  formData: FormData,
): Promise<MediaActionState> {
  const denied = await requireMediaAdmin()
  if (denied) return denied

  const id = String(formData.get('id') ?? '').trim()
  const title = String(formData.get('title') ?? '').trim()
  const result = await renameMediaCategory({ id, title })
  if (result.error) return { error: result.error }
  revalidatePath('/admin/media')
  return { ok: true, message: 'Folder renamed.' }
}

export async function deleteMediaCategoryAction(
  _prev: MediaActionState,
  formData: FormData,
): Promise<MediaActionState> {
  const denied = await requireMediaAdmin()
  if (denied) return denied

  const id = String(formData.get('id') ?? '').trim()
  const result = await deleteMediaCategory({ id })
  if (result.error) return { error: result.error }
  revalidatePath('/admin/media')
  return { ok: true, message: 'Folder deleted.' }
}

/** Current viewer’s decode / resize choice flags for upload UI. */
export async function getMediaEncodePolicyAction(): Promise<
  MediaEncodePolicy | { error: string }
> {
  try {
    return await getMediaEncodePolicy()
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not load encode policy.' }
  }
}

export async function uploadMediaAction(
  _prev: MediaActionState,
  formData: FormData,
): Promise<MediaActionState> {
  const denied = await requireMediaAdmin()
  if (denied) return denied

  const file = formData.get('file')
  if (!(file instanceof File) || file.size <= 0) {
    return { error: 'Choose an image to upload.' }
  }
  if (!file.type.startsWith('image/')) {
    return { error: 'Only image uploads are supported in this library.' }
  }

  try {
    const { decodeToWebp, resize } = await resolvePostedMediaEncodeFlags(formData)
    // Shared pipeline + Payload write — also used by member uploads (ingest.ts).
    const { media } = await ingestImageUpload({
      file,
      alt: String(formData.get('alt') ?? ''),
      categoryRaw: String(formData.get('category') ?? ''),
      folderRaw: String(formData.get('folder') ?? ''),
      purpose: String(formData.get('purpose') ?? 'photo'),
      tagRaw: String(formData.get('tag') ?? ''),
      decodeToWebp,
      resize,
    })

    revalidatePath('/admin/media')
    return {
      ok: true,
      message: 'Uploaded.',
      ...(media ? { media } : {}),
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Upload failed.' }
  }
}

function parseGroupModeFormMap(
  formData: FormData,
  prefix: string,
): Record<string, MediaEncodeGroupMode> {
  const out: Record<string, MediaEncodeGroupMode> = {}
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith(prefix)) continue
    const id = key.slice(prefix.length).trim()
    if (!id) continue
    const mode = String(value)
    if (isMediaEncodeGroupMode(mode)) out[id] = mode
  }
  return normalizeMediaEncodeGroupMap(out)
}

export async function deleteMediaAction(
  _prev: MediaActionState,
  formData: FormData,
): Promise<MediaActionState> {
  const denied = await requireMediaAdmin()
  if (denied) return denied

  const id = String(formData.get('id') ?? '').trim()
  if (!id) return { error: 'Missing media id.' }

  try {
    const payload = await getPayload({ config })
    await payload.delete({
      collection: 'media',
      id,
      overrideAccess: true,
    })
    revalidatePath('/admin/media')
    return { ok: true, message: 'Deleted.' }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Delete failed.' }
  }
}

function collectBulkIds(formData: FormData): string[] {
  const fromMulti = formData.getAll('ids').flatMap((v) => parseMediaBulkIds(v))
  const fromCsv = parseMediaBulkIds(formData.get('idsCsv') ?? formData.get('ids'))
  return parseMediaBulkIds([...fromMulti, ...fromCsv])
}

/** Bulk delete selected media (Phase 3). */
export async function bulkDeleteMediaAction(
  _prev: MediaActionState,
  formData: FormData,
): Promise<MediaActionState> {
  const denied = await requireMediaAdmin()
  if (denied) return denied

  const ids = collectBulkIds(formData)
  if (!ids.length) return { error: 'Select at least one item.' }

  try {
    const payload = await getPayload({ config })
    let affected = 0
    for (const id of ids) {
      await payload.delete({ collection: 'media', id, overrideAccess: true })
      affected += 1
    }
    // Client router.refresh() after ok — avoid folding a full library RSC into this action.
    return {
      ok: true,
      message: affected === 1 ? 'Deleted 1 item.' : `Deleted ${affected} items.`,
      affected,
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Bulk delete failed.' }
  }
}

/**
 * Bulk move (category) and/or add a tag on selected media.
 * Pass `category` and/or `tag` — at least one required.
 */
export async function bulkUpdateMediaAction(
  _prev: MediaActionState,
  formData: FormData,
): Promise<MediaActionState> {
  const denied = await requireMediaAdmin()
  if (denied) return denied

  const ids = collectBulkIds(formData)
  if (!ids.length) return { error: 'Select at least one item.' }

  const categoryRaw = String(formData.get('category') ?? '').trim()
  const tagRaw = String(formData.get('tag') ?? '').trim()
  const clearCategory = formData.get('clearCategory') === '1'
  const hasCategory = clearCategory || (categoryRaw && categoryRaw !== 'all')
  const hasTag = Boolean(tagRaw)
  if (!hasCategory && !hasTag) {
    return { error: 'Choose a folder and/or tag for the bulk update.' }
  }

  try {
    const payload = await getPayload({ config })

    let categoryId: number | null = null
    let folder: MediaFolder | undefined
    if (clearCategory) {
      categoryId = null
      folder = 'general'
    } else if (hasCategory) {
      const n = Number(categoryRaw)
      if (!Number.isFinite(n)) return { error: 'Invalid folder.' }
      categoryId = n
      // Folder options already come from the live category tree — no seed pass here.
      folder = await resolveFolderForCategory(String(categoryId))
    }

    const tagId = tagRaw ? Number(tagRaw) : NaN
    if (hasTag && !Number.isFinite(tagId)) return { error: 'Invalid tag.' }

    let affected = 0
    for (const id of ids) {
      const data: Record<string, unknown> = {}
      if (hasCategory) {
        data.category = categoryId
        if (folder) data.folder = folder
      }
      if (hasTag) {
        const existing = await payload.findByID({
          collection: 'media',
          id,
          depth: 0,
          overrideAccess: true,
        })
        if (!existing) continue
        const currentTags = Array.isArray(existing.tags)
          ? existing.tags.map((t) =>
              typeof t === 'object' && t && 'id' in t ? Number(t.id) : Number(t),
            )
          : []
        const nextTags = [...new Set([...currentTags.filter(Number.isFinite), tagId])]
        data.tags = nextTags
      }

      // Metadata-only: skip sharp pipeline and keep the returned doc tiny so the
      // server action can finish without re-rendering a full Media upload cycle.
      await payload.update({
        collection: 'media',
        id,
        data,
        depth: 0,
        overrideAccess: true,
        context: { [STARFORGE_PIPELINE_APPLIED]: true },
        select: { id: true, category: true, folder: true, tags: true },
      })
      affected += 1
    }

    // Do not revalidatePath here — Next folds the refreshed RSC tree into the
    // action response, which freezes the library UI until listMedia finishes.
    // The client calls router.refresh() after ok instead.
    return {
      ok: true,
      message: affected === 1 ? 'Updated 1 item.' : `Updated ${affected} items.`,
      affected,
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Bulk update failed.' }
  }
}

/**
 * Run MediaAnalysisPort on one media item (explicit Analyze — never auto).
 * Returns suggestions for confirm; does not write Media fields.
 */
export async function analyzeMediaAction(
  _prev: MediaActionState,
  formData: FormData,
): Promise<MediaActionState> {
  const denied = await requireMediaAdmin()
  if (denied) return denied

  const id = String(formData.get('id') ?? '').trim()
  if (!id) return { error: 'Missing media id.' }

  try {
    const payload = await getPayload({ config })
    const doc = await payload.findByID({
      collection: 'media',
      id,
      depth: 0,
      overrideAccess: true,
    })
    if (!doc) return { error: 'Media not found.' }

    const port = getMediaAnalysisPort()
    const hooks = port.list().map((a) => a.id)
    if (!hooks.length) {
      return { error: 'No analysis adapters registered.' }
    }

    const mime = (doc.mimeType || 'application/octet-stream').toLowerCase()
    const url = typeof doc.url === 'string' ? doc.url : undefined
    const analysis = await port.run({
      mediaId: String(doc.id),
      mime,
      source: {
        ...(url ? { url } : {}),
      },
      purpose: normalizeMediaPurpose(doc.purpose),
      hooks,
    })

    const suggestions = mergeMediaAnalysisSuggestions(analysis)
    return {
      ok: true,
      message:
        analysis.length === 1
          ? analysis[0]?.summary || 'Analysis complete.'
          : `Ran ${analysis.length} analyzers.`,
      analysis,
      ...(mediaSuggestionPatchIsEmpty(suggestions) ? {} : { suggestions }),
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Analyze failed.' }
  }
}

/** Apply confirmed analysis suggestions to a Media document. */
export async function applyMediaAnalysisSuggestionsAction(
  _prev: MediaActionState,
  formData: FormData,
): Promise<MediaActionState> {
  const denied = await requireMediaAdmin()
  if (denied) return denied

  const id = String(formData.get('id') ?? '').trim()
  if (!id) return { error: 'Missing media id.' }

  const alt = String(formData.get('alt') ?? '').trim()
  const purposeRaw = String(formData.get('purpose') ?? '').trim()
  const categoryRaw = String(formData.get('categoryId') ?? '').trim()
  const tagIds = parseMediaBulkIds(formData.get('tagIds'))

  if (!alt && !purposeRaw && !categoryRaw && !tagIds.length) {
    return { error: 'Nothing to apply.' }
  }

  try {
    const payload = await getPayload({ config })
    const existing = await payload.findByID({
      collection: 'media',
      id,
      depth: 0,
      overrideAccess: true,
    })
    if (!existing) return { error: 'Media not found.' }

    const data: Record<string, unknown> = {}
    if (alt) data.alt = alt
    if (purposeRaw) data.purpose = normalizeMediaPurpose(purposeRaw)
    if (categoryRaw) {
      const n = Number(categoryRaw)
      if (Number.isFinite(n)) {
        data.category = n
        data.folder = await resolveFolderForCategory(String(n))
      }
    }
    if (tagIds.length) {
      const currentTags = Array.isArray(existing.tags)
        ? existing.tags.map((t) =>
            typeof t === 'object' && t && 'id' in t ? Number(t.id) : Number(t),
          )
        : []
      const next = [
        ...new Set([
          ...currentTags.filter(Number.isFinite),
          ...tagIds.map(Number).filter(Number.isFinite),
        ]),
      ]
      data.tags = next
    }

    const doc = await payload.update({
      collection: 'media',
      id,
      data,
      overrideAccess: true,
    })
    revalidatePath('/admin/media')
    const media = toResolvedMedia(doc as Parameters<typeof toResolvedMedia>[0], {
      size: 'thumbnail',
      preferWebp: true,
    })
    return {
      ok: true,
      message: 'Suggestions applied.',
      ...(media ? { media } : {}),
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not apply suggestions.' }
  }
}

export async function saveMediaPipelineSettingsAction(
  _prev: MediaActionState,
  formData: FormData,
): Promise<MediaActionState> {
  const admin = await requireAppAdmin()
  if (!admin) {
    return { error: 'Sign in as a Starforge app admin to edit Media settings.' }
  }

  const current = await getMediaPipelineRules()
  const next: MediaPipelineRules = normalizeMediaPipelineRules({
    ...current,
    maxWidth: formData.get('maxWidth'),
    maxHeight: formData.get('maxHeight'),
    jpegQuality: formData.get('jpegQuality'),
    webpQuality: formData.get('webpQuality'),
    keepPngForLogos: formData.get('keepPngForLogos') === 'on',
    decodeByGroup: parseGroupModeFormMap(formData, 'decodeByGroup:'),
    resizeByGroup: parseGroupModeFormMap(formData, 'resizeByGroup:'),
    sizes: {
      thumbnail: formData.get('sizeThumbnail') ?? current.sizes.thumbnail,
      card: formData.get('sizeCard') ?? current.sizes.card,
      large: formData.get('sizeLarge') ?? current.sizes.large,
    },
  })

  try {
    await saveMediaPipelineRules(next)
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not save Media settings.' }
  }

  revalidatePath('/admin/media')
  revalidatePath('/admin/media/settings')
  return { ok: true, message: 'Saved.' }
}

export type { MediaFolder, MediaPurpose, ResolvedMedia, MediaSuggestionPatch }
