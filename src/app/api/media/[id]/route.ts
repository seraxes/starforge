import { NextResponse } from 'next/server'

import { isPrivateFormMedia } from '@/core/media/privacy'
import { findMediaById, toResolvedMedia } from '@/core/media/resolve'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * Public bind helper (SF-28 / SF-66 interim).
 * Redirects to the preferred Payload file URL for a media id.
 * Form respondent attachments (folder=forms / private) are not public —
 * use `/api/admin/form-attachments/[id]` from Core admin.
 */
export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params
  const doc = await findMediaById(id)
  if (!doc) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (isPrivateFormMedia(doc)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const resolved = toResolvedMedia(doc, { preferWebp: true })
  if (!resolved?.url) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.redirect(resolved.absoluteUrl || resolved.url, 302)
}
