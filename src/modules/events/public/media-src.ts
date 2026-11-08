/**
 * Resolve a Media library id to a public image URL for event covers.
 */

import 'server-only'

import { resolveMediaBind } from '@/core/media/resolve'

/** Prefer bound Payload URL; fall back to `/api/media/:id` redirect helper. */
export async function resolveEventMediaSrc(
  mediaId: string | null | undefined,
): Promise<string> {
  const id = (mediaId || '').trim()
  if (!id) return ''
  try {
    const resolved = await resolveMediaBind({
      mediaId: id,
      preferWebp: true,
      size: 'large',
    })
    if (resolved?.src) return resolved.src
  } catch {
    // Payload / media missing — fall through
  }
  return `/api/media/${encodeURIComponent(id)}`
}
