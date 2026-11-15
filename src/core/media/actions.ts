'use server'

import { revalidatePath } from '@/core/content/defer-revalidate'

import { requireAppAdmin } from '@/core/auth/admin'

import { getMediaAnalysisPort } from './analysis'
import type { MediaAnalysisResult } from './analysis/types'
import type { MediaCategoryNode } from './categories'
import {
  createMediaCategory,
  deleteMediaCategory,
  ensureLegacyCategoryRoots,
  findCategoryById,
  listMediaCategoryTree,
  renameMediaCategory,
  resolveFolderForCategory,
} from './category-store'
import {
  addMediaAssetTag,
  getMediaAsset,
  setMediaAssetCategory,
  updateMediaAssetDetails,
} from './document-store'
import { resolvePostedMediaEncodeFlags, getMediaEncodePolicy } from './encode-policy'
import { ingestImageUpload, removeMediaAsset, replaceMediaFile } from './ingest'
import { isAdminLibraryUploadAllowed, resolveAdminLibraryMime } from './library-files'
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
import { createMediaTag, renameMediaTag } from './tag-store'

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
    return { error: 'Choose a file to upload.' }
  }
  const documents = formData.get('libraryDocuments') === '1'
  if (!isAdminLibraryUploadAllowed(file.type, file.name, { documents })) {
    return {
      error: documents
        ? 'That file type is not allowed. Use an image, PDF, Word document, or plain text file.'
        : 'Only image uploads are supported in this library.',
    }
  }

  try {
    const { decodeToWebp, resize } = await resolvePostedMediaEncodeFlags(formData)
    const mimeType = resolveAdminLibraryMime(file.type, file.name)
    const uploadFile =
      mimeType === file.type
        ? file
        : new File([await file.arrayBuffer()], file.name, { type: mimeType })
    // Shared pipeline + sf_media_* write — also used by member uploads (ingest.ts).
    const { media } = await ingestImageUpload({
      file: uploadFile,
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
    await removeMediaAsset(id)
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
    let affected = 0
    for (const id of ids) {
      await removeMediaAsset(id)
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
    let categoryId: string | null = null
    let folder: MediaFolder | undefined
    if (clearCategory) {
      categoryId = null
      folder = 'general'
    } else if (hasCategory) {
      const cat = await findCategoryById(categoryRaw)
      if (!cat) return { error: 'Invalid folder.' }
      categoryId = cat.id
      folder = await resolveFolderForCategory(categoryId)
    }

    const tagId = tagRaw.trim()
    if (hasTag && !tagId) return { error: 'Invalid tag.' }

    let affected = 0
    for (const id of ids) {
      const existing = await getMediaAsset(id)
      if (!existing) continue
      if (hasCategory && folder) {
        await setMediaAssetCategory({ id, categoryId, folder })
      }
      if (hasTag) await addMediaAssetTag(id, tagId)
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
    const doc = await getMediaAsset(id)
    if (!doc) return { error: 'Media not found.' }

    const port = getMediaAnalysisPort()
    const hooks = port.list().map((a) => a.id)
    if (!hooks.length) {
      return { error: 'No analysis adapters registered.' }
    }

    const mime = (doc.mimeType || 'application/octet-stream').toLowerCase()
    const url = typeof doc.url === 'string' ? doc.url : undefined
    const analysis = await port.run({
      mediaId: doc.id,
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
    const existing = await getMediaAsset(id)
    if (!existing) return { error: 'Media not found.' }

    let categoryId = existing.categoryId
    let folder: string | undefined
    if (categoryRaw) {
      const cat = await findCategoryById(categoryRaw)
      if (!cat) return { error: 'Invalid folder.' }
      categoryId = cat.id
      folder = await resolveFolderForCategory(cat.id)
    }
    const nextTags = tagIds.length
      ? [...new Set([...existing.tagIds, ...tagIds])]
      : existing.tagIds

    const doc = await updateMediaAssetDetails({
      id,
      alt: alt || existing.alt,
      purpose: purposeRaw ? normalizeMediaPurpose(purposeRaw) : normalizeMediaPurpose(existing.purpose),
      categoryId,
      ...(folder !== undefined ? { folder } : {}),
      isPrivate: existing.private,
      tagIds: nextTags,
    })
    revalidatePath('/admin/media')
    const media = doc
      ? toResolvedMedia(doc, { size: 'thumbnail', preferWebp: true })
      : null
    return {
      ok: true,
      message: 'Suggestions applied.',
      ...(media ? { media } : {}),
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not apply suggestions.' }
  }
}

/**
 * Single-item metadata edit (alt, purpose, category, tags, private).
 * Does not touch the file.
 */
export async function updateMediaDetailsAction(
  _prev: MediaActionState,
  formData: FormData,
): Promise<MediaActionState> {
  const denied = await requireMediaAdmin()
  if (denied) return denied

  const id = String(formData.get('id') ?? '').trim()
  if (!id) return { error: 'Missing media id.' }

  const alt = String(formData.get('alt') ?? '').trim()
  if (!alt) return { error: 'Add a short label for this file.' }

  const purpose = normalizeMediaPurpose(String(formData.get('purpose') ?? 'photo'))
  const categoryRaw = String(formData.get('category') ?? '').trim()
  const tagIds = formData
    .getAll('tagIds')
    .map((value) => String(value).trim())
    .filter(Boolean)
  const isPrivate = formData.get('private') === '1'

  try {
    let categoryId: string | null = null
    let folder: string | undefined
    if (categoryRaw) {
      const cat = await findCategoryById(categoryRaw)
      if (!cat) return { error: 'Invalid folder.' }
      categoryId = cat.id
      folder = await resolveFolderForCategory(cat.id)
    }

    await updateMediaAssetDetails({
      id,
      alt,
      purpose,
      categoryId,
      ...(folder !== undefined ? { folder } : {}),
      isPrivate,
      tagIds,
    })
    return { ok: true, message: 'Saved.' }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not save media.' }
  }
}

/**
 * In-place file replace. `replaceMediaFile` runs sharp and regenerates
 * thumbnail / card / large. Metadata stays on the same document.
 */
export async function replaceMediaFileAction(
  _prev: MediaActionState,
  formData: FormData,
): Promise<MediaActionState> {
  const denied = await requireMediaAdmin()
  if (denied) return denied

  const id = String(formData.get('id') ?? '').trim()
  if (!id) return { error: 'Missing media id.' }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size <= 0) {
    return { error: 'Choose a file to replace the current one.' }
  }
  if (!isAdminLibraryUploadAllowed(file.type, file.name, { documents: true })) {
    return {
      error: 'That file type is not allowed. Use an image, PDF, Word document, or plain text file.',
    }
  }

  try {
    const { decodeToWebp, resize } = await resolvePostedMediaEncodeFlags(formData)
    const mimeType = resolveAdminLibraryMime(file.type, file.name)
    const uploadFile =
      mimeType === file.type
        ? file
        : new File([await file.arrayBuffer()], file.name, { type: mimeType })
    const { media } = await replaceMediaFile({
      id,
      file: uploadFile,
      decodeToWebp,
      resize,
    })
    return {
      ok: true,
      message: 'File replaced.',
      ...(media ? { media } : {}),
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not replace file.' }
  }
}

export async function createMediaTagAction(
  _prev: MediaActionState,
  formData: FormData,
): Promise<MediaActionState> {
  const denied = await requireMediaAdmin()
  if (denied) return denied

  const result = await createMediaTag({ title: String(formData.get('title') ?? '') })
  if ('error' in result) return { error: result.error }
  return { ok: true, message: 'Tag created.' }
}

export async function renameMediaTagAction(
  _prev: MediaActionState,
  formData: FormData,
): Promise<MediaActionState> {
  const denied = await requireMediaAdmin()
  if (denied) return denied

  const result = await renameMediaTag({
    id: String(formData.get('id') ?? ''),
    title: String(formData.get('title') ?? ''),
  })
  if ('error' in result) return { error: result.error }
  return { ok: true, message: 'Tag renamed.' }
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
