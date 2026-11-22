import { NextResponse } from 'next/server'

import { isPrivateFormMedia } from '@/core/media/privacy'
import {
  findMediaById,
  preferredMediaUrl,
  toResolvedMedia,
  type MediaSizeName,
} from '@/core/media/resolve'
import type { MediaDoc } from '@/core/media/media-record'

import {
  gateSocialMediaServe,
  isAbsoluteHttpUrl,
  mediaNotFoundResponse,
  siteRelativeMediaFileUrl,
} from '../social-serve-gate'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * Redirect to a file URL while keeping site-relative paths on the *request*
 * origin. Do not use NEXT_PUBLIC_APP_URL here — that host often differs from
 * the browser (127.0.0.1 vs localhost, LAN IP, tunnel) and CSP img-src 'self'
 * then blocks the cross-origin redirect. Absolute http(s) (S3/CDN) pass through
 * only for unrestricted (public / unbound) media.
 */
function redirectToMediaUrl(
  req: Request,
  url: string,
  opts?: { restricted?: boolean; doc?: MediaDoc; size?: MediaSizeName | 'original' },
): NextResponse {
  const raw = url.trim()
  if (!raw) {
    return mediaNotFoundResponse()
  }

  if (opts?.restricted && isAbsoluteHttpUrl(raw)) {
    const sizeEntry =
      opts.size && opts.size !== 'original' ? opts.doc?.sizes?.[opts.size] : null
    const safe = siteRelativeMediaFileUrl({
      path: opts.doc?.path,
      filename: opts.doc?.filename,
      sizePath: sizeEntry?.path,
      sizeFilename: sizeEntry?.filename,
    })
    if (!safe) {
      return mediaNotFoundResponse()
    }
    return NextResponse.redirect(new URL(safe, req.url), 302)
  }

  if (isAbsoluteHttpUrl(raw)) {
    return NextResponse.redirect(raw, 302)
  }
  const path = raw.startsWith('/') ? raw : `/${raw}`
  return NextResponse.redirect(new URL(path, req.url), 302)
}

/**
 * Public bind helper (SF-28 / SF-66 interim).
 * Redirects to the stored file URL for a media id (`/api/media/file/…` or CDN).
 *
 * Query `variant`:
 * - `original` — full uploaded file (use for crop / pan editors — thumbnails are square-cropped)
 * - `large` | `card` | `thumbnail` — WebP derivatives
 * - omit — preferred large/card WebP (existing default)
 *
 * Form respondent attachments (folder=forms / private) are not public —
 * use `/api/admin/form-attachments/[id]` from Core admin.
 * Social-bound non-public files 404 for viewers canViewBoundMedia denies.
 */
export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params
  const doc = await findMediaById(id)
  if (!doc) {
    return mediaNotFoundResponse()
  }
  if (isPrivateFormMedia(doc)) {
    return mediaNotFoundResponse()
  }

  const gate = await gateSocialMediaServe(doc.id)
  if (!gate.allow) {
    return mediaNotFoundResponse()
  }
  const restricted = gate.restricted === true

  const variant = new URL(req.url).searchParams.get('variant')?.trim().toLowerCase() || ''

  if (variant === 'original') {
    const raw = (doc.url || '').trim()
    if (!raw) {
      return mediaNotFoundResponse()
    }
    return redirectToMediaUrl(req, raw, { restricted, doc, size: 'original' })
  }

  if (variant === 'large' || variant === 'card' || variant === 'thumbnail') {
    const url = preferredMediaUrl(doc, {
      size: variant as MediaSizeName,
      preferWebp: true,
    })
    if (!url) {
      return mediaNotFoundResponse()
    }
    return redirectToMediaUrl(req, url, {
      restricted,
      doc,
      size: variant as MediaSizeName,
    })
  }

  const resolved = toResolvedMedia(doc, { preferWebp: true })
  if (!resolved?.url) {
    return mediaNotFoundResponse()
  }
  return redirectToMediaUrl(req, resolved.url, { restricted, doc, size: 'large' })
}
