'use server'

import { revalidatePath } from 'next/cache'
import { getPayload } from 'payload'

import config from '@payload-config'
import { requireAppAdmin } from '@/core/auth/admin'

import {
  STARFORGE_PIPELINE_APPLIED,
  applyMediaPipelineRules,
} from './apply-pipeline'
import type { MediaCategoryNode } from './categories'
import {
  createMediaCategory,
  deleteMediaCategory,
  ensureLegacyCategoryRoots,
  listMediaCategoryTree,
  renameMediaCategory,
  resolveFolderForCategory,
} from './category-store'
import {
  normalizeMediaFolder,
  normalizeMediaPipelineRules,
  normalizeMediaPurpose,
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
  revalidatePath('/app/admin/media')
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
  revalidatePath('/app/admin/media')
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
  revalidatePath('/app/admin/media')
  return { ok: true, message: 'Folder deleted.' }
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

  const alt = String(formData.get('alt') ?? '').trim() || file.name.replace(/\.[^.]+$/, '') || 'Image'
  const categoryRaw = String(formData.get('category') ?? '').trim()
  const folderRaw = String(formData.get('folder') ?? '').trim()
  const purpose = normalizeMediaPurpose(String(formData.get('purpose') ?? 'photo'))
  const tagRaw = String(formData.get('tag') ?? '').trim()

  try {
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

    revalidatePath('/app/admin/media')
    const media = toResolvedMedia(doc as Parameters<typeof toResolvedMedia>[0], {
      size: 'thumbnail',
      preferWebp: true,
    })
    return {
      ok: true,
      message: 'Uploaded.',
      ...(media ? { media } : {}),
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Upload failed.' }
  }
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
    revalidatePath('/app/admin/media')
    return { ok: true, message: 'Deleted.' }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Delete failed.' }
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
    sizes: current.sizes,
  })

  try {
    await saveMediaPipelineRules(next)
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not save Media settings.' }
  }

  revalidatePath('/app/admin/media')
  revalidatePath('/app/admin/media/settings')
  return { ok: true, message: 'Saved.' }
}

export type { MediaFolder, MediaPurpose, ResolvedMedia }
