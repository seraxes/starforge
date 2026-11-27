/**
 * Resolve a Media library id to a public image URL for listing photos.
 */

import 'server-only'

import { resolveMediaBind } from '@/modules/media/api.server'

/** Prefer bound URL; fall back to `/api/media/:id`. */
export async function resolveListingMediaSrc(
  mediaId: string | null | undefined,
): Promise<string> {
  const id = (mediaId || '').trim()
  if (!id) return ''
  try {
    const resolved = await resolveMediaBind({
      mediaId: id,
      preferWebp: true,
      size: 'card',
    })
    if (resolved?.src) return resolved.src
  } catch {
    // Media missing — fall through
  }
  return `/api/media/${encodeURIComponent(id)}`
}

export async function resolveListingMediaSrcs(
  mediaIds: string[],
): Promise<string[]> {
  const out: string[] = []
  for (const id of mediaIds) {
    const src = await resolveListingMediaSrc(id)
    if (src) out.push(src)
  }
  return out
}
