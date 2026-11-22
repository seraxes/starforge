/**
 * App-route helper: ask Social whether this media id may be served.
 * product:media stays free of Social imports — routes use loadModuleDoor.
 */

import 'server-only'

import { NextResponse } from 'next/server'

import { getAppSession } from '@/core/auth/session'
import { loadModuleDoor } from '@/generated/module-registry.server'

export type MediaServeGate =
  | { allow: true; restricted: false }
  | { allow: true; restricted: true }
  | { allow: false }

/** Same 404 body shape as a missing file. */
export function mediaNotFoundResponse(): NextResponse {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

/**
 * Social bind check for a media id. Social off / unbound / door missing →
 * allow unrestricted. Explicit deny from the door still 404s.
 */
export async function gateSocialMediaServe(
  mediaId: string,
): Promise<MediaServeGate> {
  const id = mediaId.trim()
  if (!id) return { allow: false }

  try {
    const session = await getAppSession()
    const viewerUserId = session?.user?.id?.trim() || null
    const door = await loadModuleDoor('social-api-server')
    const decide = door?.decideSocialMediaServeAccess as
      | ((input: {
          mediaId: string
          viewerUserId: string | null
        }) => Promise<MediaServeGate>)
      | undefined
    if (!decide) {
      return { allow: true, restricted: false }
    }
    return await decide({ mediaId: id, viewerUserId })
  } catch (error) {
    console.error('[media] social serve gate failed', error)
    return { allow: true, restricted: false }
  }
}

/** Prefer a site-relative file URL so restricted media never hits a public CDN. */
export function siteRelativeMediaFileUrl(opts: {
  path?: string | null
  filename?: string | null
  sizePath?: string | null
  sizeFilename?: string | null
}): string | null {
  const key =
    opts.sizePath?.trim() ||
    opts.sizeFilename?.trim() ||
    opts.path?.trim() ||
    opts.filename?.trim() ||
    ''
  if (!key) return null
  const path = key.startsWith('/') ? key.slice(1) : key
  if (!path || path.includes('..') || path.includes('\\')) return null
  return `/api/media/file/${path
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')}`
}

export function isAbsoluteHttpUrl(url: string): boolean {
  const raw = url.trim()
  return raw.startsWith('http://') || raw.startsWith('https://')
}
