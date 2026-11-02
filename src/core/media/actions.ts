'use server'

import { revalidatePath } from 'next/cache'
import { getPayload } from 'payload'
import sharp from 'sharp'

import config from '@payload-config'
import { requireAppAdmin } from '@/core/auth/admin'

import {
  MEDIA_JPEG_QUALITY,
  MEDIA_MAX_HEIGHT,
  MEDIA_MAX_WIDTH,
  MEDIA_WEBP_QUALITY,
  normalizeMediaFolder,
  normalizeMediaPurpose,
  type MediaFolder,
  type MediaPurpose,
} from './pipeline'
import { listMedia, toResolvedMedia, type ResolvedMedia } from './resolve'
import { getMediaStorageInfo } from './storage'

/**
 * Cap dimensions; re-encode JPEG at MEDIA_JPEG_QUALITY; leave PNG alone (logos).
 * Payload collection still applies resizeOptions + WebP sizes as a second pass.
 */
async function preprocessUploadBuffer(
  buffer: Buffer,
  mimeType: string,
  purpose: MediaPurpose,
): Promise<{ data: Buffer; mimetype: string; extHint?: string }> {
  const mime = mimeType.toLowerCase()
  const image = sharp(buffer).rotate()
  const meta = await image.metadata()
  const width = meta.width ?? MEDIA_MAX_WIDTH
  const height = meta.height ?? MEDIA_MAX_HEIGHT
  const needsResize = width > MEDIA_MAX_WIDTH || height > MEDIA_MAX_HEIGHT
  let pipeline = image
  if (needsResize) {
    pipeline = pipeline.resize({
      width: MEDIA_MAX_WIDTH,
      height: MEDIA_MAX_HEIGHT,
      fit: 'inside',
      withoutEnlargement: true,
    })
  }

  // Logos / PNG: keep format (PNG logos must stay PNG).
  if (mime === 'image/png') {
    const data = await pipeline.png().toBuffer()
    return { data, mimetype: 'image/png' }
  }
  if (purpose === 'logo' && (mime === 'image/jpeg' || mime === 'image/jpg')) {
    const data = await pipeline.jpeg({ quality: MEDIA_JPEG_QUALITY, mozjpeg: true }).toBuffer()
    return { data, mimetype: 'image/jpeg', extHint: 'jpg' }
  }

  // Photos / other: convert to WebP (modern default).
  if (
    mime === 'image/jpeg' ||
    mime === 'image/jpg' ||
    mime === 'image/webp' ||
    mime === 'image/gif' ||
    mime.startsWith('image/')
  ) {
    const data = await pipeline.webp({ quality: MEDIA_WEBP_QUALITY }).toBuffer()
    return { data, mimetype: 'image/webp', extHint: 'webp' }
  }

  const data = await pipeline.toBuffer()
  return { data, mimetype: mimeType }
}

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

  try {
    const payload = await getPayload({ config })
    const raw = Buffer.from(await file.arrayBuffer())
    const processed = await preprocessUploadBuffer(raw, file.type, purpose)
    let name = file.name || `upload-${Date.now()}.jpg`
    if (processed.extHint) {
      name = name.replace(/\.[^.]+$/, '') + `.${processed.extHint}`
    }
    const doc = await payload.create({
      collection: 'media',
      data: {
        alt,
        folder,
        purpose,
      },
      file: {
        data: processed.data,
        mimetype: processed.mimetype,
        name,
        size: processed.data.length,
      },
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
