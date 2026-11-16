import { NextResponse } from 'next/server'

import { isPrivateFormMedia } from '@/core/media/privacy'
import { findStoredObjectByKey } from '@/core/media/document-store'
import { getMediaStorage } from '@/core/media/storage'
import { assertSafeMediaKey } from '@/core/media/storage-key'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ key: string[] }> }

/**
 * Public bytes for a media storage key (original or derivative).
 * Keys follow the category prefix (`logos/events/photo.webp`).
 * Private / form files are not served here. A bare filename still resolves
 * so older `/api/media/file/<name>` links keep working.
 */
export async function GET(_req: Request, ctx: Ctx) {
  const { key: parts } = await ctx.params
  let key = ''
  try {
    key = assertSafeMediaKey((parts || []).join('/'))
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const object = await findStoredObjectByKey(key)
  if (!object || isPrivateFormMedia({ folder: object.folder, private: object.isPrivate })) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const stored = await getMediaStorage().read(object.key)
  if (!stored) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const mime = stored.mimeType || object.mimeType || 'application/octet-stream'
  return new NextResponse(new Uint8Array(stored.body), {
    status: 200,
    headers: {
      'Content-Type': mime,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
