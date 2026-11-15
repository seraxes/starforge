import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { NextResponse } from 'next/server'

import { requireAppAdmin } from '@/core/auth/admin'
import { findMediaById } from '@/core/media/resolve'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

const mediaStaticDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../../../media',
)

function contentDisposition(filename: string, inline: boolean): string {
  const safe = filename.replace(/["\r\n]/g, '_') || 'attachment'
  return `${inline ? 'inline' : 'attachment'}; filename="${safe}"`
}

/**
 * Core-admin gate for Form respondent attachments (private Media).
 * Streams bytes with overrideAccess so Better Auth admins do not need a Payload
 * session (Payload `/api/media/file/*` stays locked for anonymous + private docs).
 */
export async function GET(req: Request, ctx: Ctx) {
  const admin = await requireAppAdmin()
  if (!admin?.user) {
    return NextResponse.json({ error: 'Admins only.' }, { status: 401 })
  }

  const { id } = await ctx.params
  const doc = await findMediaById(id)
  if (!doc?.filename) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const mime = doc.mimeType || 'application/octet-stream'
  const ext = doc.filename.toLowerCase()
  const svg = mime === 'image/svg+xml' || ext.endsWith('.svg') || ext.endsWith('.svgz')
  const inline = new URL(req.url).searchParams.get('inline') === '1' && !svg
  const headers = {
    'Content-Type': mime,
    'Content-Disposition': contentDisposition(doc.filename, inline),
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  }

  // Local Payload staticDir (default adapter).
  const localPath = path.join(mediaStaticDir, doc.filename)
  try {
    const data = await fs.readFile(localPath)
    return new NextResponse(data, { status: 200, headers })
  } catch {
    // Not on local disk — try URL (S3/Spaces plugin or absolute asset URL).
  }

  const url = (doc.url || '').trim()
  if (!url) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const absolute =
      url.startsWith('http://') || url.startsWith('https://')
        ? url
        : `${(process.env.NEXT_PUBLIC_SERVER_URL || '').replace(/\/$/, '')}${url.startsWith('/') ? url : `/${url}`}`
    if (!absolute.startsWith('http')) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    const upstream = await fetch(absolute, { redirect: 'follow' })
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        ...headers,
        'Content-Type': upstream.headers.get('content-type') || mime,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
