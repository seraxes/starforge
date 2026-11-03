'use server'

import { revalidatePath } from 'next/cache'
import { getPayload } from 'payload'

import config from '@payload-config'
import { requireAppAdmin } from '@/core/auth/admin'

import {
  STARFORGE_PIPELINE_APPLIED,
  applyMediaPipelineRules,
} from './apply-pipeline'
import {
  normalizeMediaFolder,
  normalizeMediaPurpose,
  type MediaFolder,
  type MediaPurpose,
} from './pipeline'
import {
  listMedia,
  listMediaTagOptions,
  toResolvedMedia,
  type MediaTagOption,
  type ResolvedMedia,
} from './resolve'
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
  const folder = normalizeMediaFolder(String(formData.get('folder') ?? 'general'))
  const purpose = normalizeMediaPurpose(String(formData.get('purpose') ?? 'photo'))
  const tagRaw = String(formData.get('tag') ?? '').trim()

  try {
    const payload = await getPayload({ config })
    const raw = Buffer.from(await file.arrayBuffer())
    const processed = await applyMediaPipelineRules({
      buffer: raw,
      mimeType: file.type,
      purpose,
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

export type { MediaFolder, MediaPurpose, ResolvedMedia }
