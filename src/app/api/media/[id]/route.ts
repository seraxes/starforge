import { NextResponse } from 'next/server'

import { isPrivateFormMedia } from '@/core/media/privacy'
import {
  findMediaById,
  preferredMediaUrl,
  toResolvedMedia,
  type MediaSizeName,
} from '@/core/media/resolve'
import { absoluteAssetUrl } from '@/core/content/metadata'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * Public bind helper (SF-28 / SF-66 interim).
 * Redirects to a Payload file URL for a media id.
 *
 * Query `variant`:
 * - `original` — full uploaded file (use for crop / pan editors — thumbnails are square-cropped)
 * - `large` | `card` | `thumbnail` — WebP derivatives
 * - omit — preferred large/card WebP (existing default)
 *
 * Form respondent attachments (folder=forms / private) are not public —
 * use `/api/admin/form-attachments/[id]` from Core admin.
 */
export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params
  const doc = await findMediaById(id)
  if (!doc) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (isPrivateFormMedia(doc)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const variant = new URL(req.url).searchParams.get('variant')?.trim().toLowerCase() || ''

  if (variant === 'original') {
    const raw = (doc.url || '').trim()
    if (!raw) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.redirect(absoluteAssetUrl(raw) || raw, 302)
  }

  if (variant === 'large' || variant === 'card' || variant === 'thumbnail') {
    const url = preferredMediaUrl(doc, {
      size: variant as MediaSizeName,
      preferWebp: true,
    })
    if (!url) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.redirect(absoluteAssetUrl(url) || url, 302)
  }

  const resolved = toResolvedMedia(doc, { preferWebp: true })
  if (!resolved?.url) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.redirect(resolved.absoluteUrl || resolved.url, 302)
}
