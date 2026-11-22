import { NextResponse } from 'next/server'

import { isPrivateFormMedia } from '@/core/media/privacy'
import { findStoredObjectByKey } from '@/core/media/document-store'
import { getMediaStorage } from '@/core/media/storage'
import { assertSafeMediaKey } from '@/core/media/storage-key'

import {
  gateSocialMediaServe,
  mediaNotFoundResponse,
} from '../../social-serve-gate'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ key: string[] }> }

/**
 * Public bytes for a media storage key (original or derivative).
 * Keys follow the category prefix (`logos/events/photo.webp`).
 * Private / form files are not served here. A bare filename still resolves
 * so older `/api/media/file/<name>` links keep working.
 * Social-bound non-public files 404 for viewers canViewBoundMedia denies, and
 * never send Cache-Control: public when restricted.
 */
export async function GET(_req: Request, ctx: Ctx) {
  const { key: parts } = await ctx.params
  let key = ''
  try {
    key = assertSafeMediaKey((parts || []).join('/'))
  } catch {
    return mediaNotFoundResponse()
  }

  const object = await findStoredObjectByKey(key)
  if (!object || isPrivateFormMedia({ folder: object.folder, private: object.isPrivate })) {
    return mediaNotFoundResponse()
  }

  const gate = await gateSocialMediaServe(object.mediaId)
  if (!gate.allow) {
    return mediaNotFoundResponse()
  }
  const restricted = gate.restricted === true

  const stored = await getMediaStorage().read(object.key)
  if (!stored) {
    return mediaNotFoundResponse()
  }

  const mime = stored.mimeType || object.mimeType || 'application/octet-stream'
  return new NextResponse(new Uint8Array(stored.body), {
    status: 200,
    headers: {
      'Content-Type': mime,
      'Cache-Control': restricted
        ? 'private, no-store'
        : 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
