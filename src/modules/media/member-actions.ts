'use server'

/**
 * Member (signed-in, non-admin) image upload for avatars, covers, and later
 * listing / post photos. Same Media pipeline + Payload library as the admin
 * library (`@/core/media/ingest`); differs only in auth, limits, and the
 * ownership ledger.
 */

import { getAppSession } from '@/core/auth/session'
import { resolvePostedMediaEncodeFlags } from '@/core/media/encode-policy'
import { ingestImageUpload } from '@/core/media/ingest'
import type { ResolvedMedia } from '@/core/media/resolve'
import { getMediaStorageInfo } from '@/core/media/storage'
import { getRateLimiter } from '@/core/security/rate-limit'

import {
  MEMBER_UPLOAD_HOURLY_LIMIT,
  MEMBER_UPLOAD_MAX_BYTES,
  isMemberUploadMimeAllowed,
  listMemberMedia,
  normalizeMemberMediaContext,
  recordMemberMedia,
} from './member'

export type MemberMediaActionState = {
  error?: string
  ok?: boolean
  media?: ResolvedMedia
}

export async function uploadMemberMediaAction(
  _prev: MemberMediaActionState,
  formData: FormData,
): Promise<MemberMediaActionState> {
  const session = await getAppSession()
  const user = session?.user as { id?: string; banned?: boolean | null } | undefined
  if (!user?.id) return { error: 'Sign in to upload images.' }
  if (user.banned) return { error: 'This account cannot upload images.' }

  const storage = getMediaStorageInfo()
  if (!storage.ready) {
    return { error: 'Image uploads are not available right now.' }
  }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size <= 0) {
    return { error: 'Choose an image to upload.' }
  }
  if (file.size > MEMBER_UPLOAD_MAX_BYTES) {
    const mb = Math.floor(MEMBER_UPLOAD_MAX_BYTES / (1024 * 1024))
    return { error: `Image is too large (max ${mb} MB).` }
  }
  if (!isMemberUploadMimeAllowed(file.type)) {
    return { error: 'Use a PNG, JPEG, GIF, or WebP image.' }
  }

  const limited = await getRateLimiter().consume(`member-media:${user.id}`, {
    limit: MEMBER_UPLOAD_HOURLY_LIMIT,
    windowSec: 3600,
  })
  if (!limited.ok) {
    return { error: 'Too many uploads — try again later.' }
  }

  const context = normalizeMemberMediaContext(formData.get('context'))

  try {
    const { decodeToWebp, resize } = await resolvePostedMediaEncodeFlags(formData)
    const { id, media } = await ingestImageUpload({
      file,
      alt: String(formData.get('alt') ?? ''),
      folderRaw: 'general',
      purpose: 'photo',
      decodeToWebp,
      resize,
    })
    await recordMemberMedia({ userId: user.id, mediaId: id, context })
    return { ok: true, ...(media ? { media } : {}) }
  } catch {
    // Do not echo pipeline / storage internals to members.
    return { error: 'Upload failed. Try a different image.' }
  }
}

/** The signed-in member's own uploads (newest first). */
export async function listMemberMediaAction(input?: {
  context?: string
}): Promise<{ error?: string; docs?: ResolvedMedia[] }> {
  const session = await getAppSession()
  const userId = session?.user?.id
  if (!userId) return { error: 'Sign in to view your images.' }
  try {
    const docs = await listMemberMedia(userId, { context: input?.context })
    return { docs }
  } catch {
    return { error: 'Could not load your images.' }
  }
}
