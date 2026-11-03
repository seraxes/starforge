import { getPayload, type Where } from 'payload'

import config from '@payload-config'
import { absoluteAssetUrl, absoluteMediaUrl } from '@/core/content/metadata'
import type { Media } from '@/payload-types'

import type { MediaPurpose } from './pipeline'

export type MediaSizeName = 'thumbnail' | 'card' | 'large'

export type ResolvedMedia = {
  id: string
  alt: string
  url: string
  /** Best-effort absolute URL for OG / external. */
  absoluteUrl: string
  mimeType?: string | null
  width?: number | null
  height?: number | null
  folder?: string | null
  purpose?: MediaPurpose | null
  filename?: string | null
  /** Shared taxonomy tag ids (SF-132 / SF-148). */
  tagIds?: string[]
  /** Display titles when tags were populated. */
  tagLabels?: string[]
  /** Thumbnail / card / large derivative URLs when present. */
  sizes?: Partial<Record<MediaSizeName, string>>
}

function mediaTagMeta(media: Media): { tagIds: string[]; tagLabels: string[] } {
  const raw = media.tags
  if (!Array.isArray(raw) || raw.length === 0) return { tagIds: [], tagLabels: [] }
  const tagIds: string[] = []
  const tagLabels: string[] = []
  for (const entry of raw) {
    if (entry == null) continue
    if (typeof entry === 'object' && 'id' in entry) {
      tagIds.push(String(entry.id))
      if (typeof entry.title === 'string' && entry.title.trim()) {
        tagLabels.push(entry.title.trim())
      }
    } else {
      tagIds.push(String(entry))
    }
  }
  return { tagIds, tagLabels }
}

type MediaSizes = Media['sizes']

function sizeUrl(sizes: MediaSizes | null | undefined, name: MediaSizeName): string | undefined {
  if (!sizes || typeof sizes !== 'object') return undefined
  const entry = sizes[name]
  if (!entry || typeof entry !== 'object') return undefined
  const url = typeof entry.url === 'string' ? entry.url.trim() : ''
  return url || undefined
}

function isPng(media: Media): boolean {
  const mime = (media.mimeType ?? '').toLowerCase()
  if (mime === 'image/png') return true
  const name = (media.filename ?? '').toLowerCase()
  return name.endsWith('.png')
}

/**
 * Prefer WebP derivative for photos; keep original URL for logos / PNG.
 */
export function preferredMediaUrl(
  media: Media,
  opts?: { size?: MediaSizeName; preferWebp?: boolean },
): string | undefined {
  const preferWebp = opts?.preferWebp !== false
  const purpose = media.purpose
  const keepOriginal = purpose === 'logo' || isPng(media)

  if (!keepOriginal && preferWebp) {
    const preferredSize = opts?.size ?? 'large'
    const sized =
      sizeUrl(media.sizes, preferredSize) ||
      sizeUrl(media.sizes, 'card') ||
      sizeUrl(media.sizes, 'thumbnail')
    if (sized) return sized
  }

  if (opts?.size) {
    const sized = sizeUrl(media.sizes, opts.size)
    if (sized) return sized
  }

  return media.url?.trim() || undefined
}

export function toResolvedMedia(
  media: Media,
  opts?: { size?: MediaSizeName; preferWebp?: boolean },
): ResolvedMedia | null {
  const url = preferredMediaUrl(media, opts)
  if (!url) return null
  const absolute = absoluteAssetUrl(url) || url
  const tags = mediaTagMeta(media)
  return {
    id: String(media.id),
    alt: media.alt || '',
    url,
    absoluteUrl: absolute,
    mimeType: media.mimeType,
    width: media.width,
    height: media.height,
    folder: media.folder ?? null,
    purpose: (media.purpose as MediaPurpose | null | undefined) ?? null,
    filename: media.filename,
    ...(tags.tagIds.length ? { tagIds: tags.tagIds } : {}),
    ...(tags.tagLabels.length ? { tagLabels: tags.tagLabels } : {}),
    sizes: {
      thumbnail: sizeUrl(media.sizes, 'thumbnail'),
      card: sizeUrl(media.sizes, 'card'),
      large: sizeUrl(media.sizes, 'large'),
    },
  }
}

/** Load a Media doc by id (string or number). */
export async function findMediaById(id: string | number): Promise<Media | null> {
  const raw = String(id ?? '').trim()
  if (!raw) return null
  try {
    const payload = await getPayload({ config })
    const doc = (await payload.findByID({
      collection: 'media',
      id: raw,
      depth: 0,
      overrideAccess: true,
    })) as Media
    return doc
  } catch {
    return null
  }
}

export async function resolveMediaById(
  id: string | number,
  opts?: { size?: MediaSizeName; preferWebp?: boolean },
): Promise<ResolvedMedia | null> {
  const doc = await findMediaById(id)
  if (!doc) return null
  return toResolvedMedia(doc, opts)
}

/** Resolve mediaId first, then fall back to a raw URL (SF-66 priority). */
export async function resolveMediaBind(opts: {
  mediaId?: string | null
  mediaUrl?: string | null
  alt?: string | null
  size?: MediaSizeName
  preferWebp?: boolean
}): Promise<{ src: string; alt: string; mediaId?: string } | null> {
  const mediaId = (opts.mediaId ?? '').trim()
  const mediaUrl = (opts.mediaUrl ?? '').trim()
  const altFallback = (opts.alt ?? '').trim()

  if (mediaId) {
    const resolved = await resolveMediaById(mediaId, {
      size: opts.size,
      preferWebp: opts.preferWebp,
    })
    if (resolved) {
      return {
        src: resolved.url,
        alt: altFallback || resolved.alt || 'Image',
        mediaId: resolved.id,
      }
    }
  }

  if (mediaUrl) {
    return { src: mediaUrl, alt: altFallback || 'Image' }
  }

  return null
}

export type MediaTagOption = {
  id: string
  title: string
  slug: string
}

/** List shared Tags for Media library facets (SF-148). */
export async function listMediaTagOptions(): Promise<MediaTagOption[]> {
  try {
    const payload = await getPayload({ config })
    const result = await payload.find({
      collection: 'tags',
      limit: 200,
      sort: 'title',
      depth: 0,
      overrideAccess: true,
    })
    return result.docs.map((doc) => ({
      id: String(doc.id),
      title: typeof doc.title === 'string' ? doc.title : String(doc.id),
      slug: typeof doc.slug === 'string' ? doc.slug : '',
    }))
  } catch {
    return []
  }
}

/** List media for admin library / picker. */
export async function listMedia(opts?: {
  folder?: string
  purpose?: string
  /** Tag id (Payload tags collection). */
  tag?: string
  q?: string
  limit?: number
  page?: number
}): Promise<{
  docs: ResolvedMedia[]
  totalDocs: number
  page: number
  totalPages: number
}> {
  const payload = await getPayload({ config })
  const limit = Math.min(Math.max(opts?.limit ?? 48, 1), 100)
  const page = Math.max(opts?.page ?? 1, 1)
  const where: Where = {}
  const folder = (opts?.folder ?? '').trim()
  const purpose = (opts?.purpose ?? '').trim()
  const tag = (opts?.tag ?? '').trim()
  const q = (opts?.q ?? '').trim()

  if (folder && folder !== 'all') {
    where.folder = { equals: folder }
  }
  if (purpose && purpose !== 'all') {
    where.purpose = { equals: purpose }
  }
  if (tag && tag !== 'all') {
    where.tags = { contains: tag }
  }
  if (q) {
    where.or = [
      { alt: { contains: q } },
      { filename: { contains: q } },
    ]
  }

  const result = await payload.find({
    collection: 'media',
    where: Object.keys(where).length ? where : undefined,
    limit,
    page,
    sort: '-createdAt',
    // depth 1 so tag titles show on library cards
    depth: 1,
    overrideAccess: true,
  })

  const docs: ResolvedMedia[] = []
  for (const raw of result.docs) {
    const resolved = toResolvedMedia(raw as Media, { size: 'thumbnail', preferWebp: true })
    if (resolved) docs.push(resolved)
    else {
      const m = raw as Media
      const tags = mediaTagMeta(m)
      docs.push({
        id: String(m.id),
        alt: m.alt || '',
        url: m.url || '',
        absoluteUrl: absoluteMediaUrl(m) || m.url || '',
        mimeType: m.mimeType,
        width: m.width,
        height: m.height,
        folder: m.folder ?? null,
        purpose: (m.purpose as MediaPurpose | null | undefined) ?? null,
        filename: m.filename,
        ...(tags.tagIds.length ? { tagIds: tags.tagIds } : {}),
        ...(tags.tagLabels.length ? { tagLabels: tags.tagLabels } : {}),
      })
    }
  }

  return {
    docs,
    totalDocs: result.totalDocs,
    page: result.page ?? page,
    totalPages: result.totalPages ?? 1,
  }
}
