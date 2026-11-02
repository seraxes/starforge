import { NextResponse } from 'next/server'

import { resolveMediaById } from '@/core/media/resolve'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * Public bind helper (SF-28 / SF-66 interim).
 * Redirects to the preferred Payload file URL for a media id.
 */
export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params
  const resolved = await resolveMediaById(id, { preferWebp: true })
  if (!resolved?.url) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.redirect(resolved.absoluteUrl || resolved.url, 302)
}
