import { absoluteAssetUrl } from '@/core/content/metadata'

import { getMediaAsset, listMediaAssets, listTagRows } from './document-store'
import { parseMediaTagFilter, type MediaTagMatchMode } from './library-query'
import type { MediaDoc, MediaSizeName, MediaSizesJson } from './media-record'
import type { MediaPurpose } from './pipeline'

export type { MediaSizeName } from './media-record'

export type ResolvedMedia = {
  id: string
  alt: string
  url: string
  /** Best-effort absolute URL for OG / external. */
  absoluteUrl: string
  /** Original file URL (pre-derivative) when available — logos / lightbox. */
  originalUrl?: string
  mimeType?: string | null
  width?: number | null
  height?: number | null
  /** Legacy flat folder (kept for Form privacy). */
  folder?: string | null
  /** Nested category id. */
  categoryId?: string | null
  /** Nested category display path / title. */
  categoryLabel?: string | null
  purpose?: MediaPurpose | null
  filename?: string | null
  /** Form / admin private flag. Folder `forms` is also private via `isPrivateFormMedia`. */
  private?: boolean | null
  /** Media-tag ids. */
  tagIds?: string[]
  /** Display titles when tags were loaded. */
  tagLabels?: string[]
  /** Thumbnail / card / large derivative URLs when present. */
  sizes?: Partial<Record<MediaSizeName, string>>
}

type MediaUrlSource = {
  url?: string | null
  mimeType?: string | null
  filename?: string | null
  purpose?: string | null
  sizes?: MediaSizesJson | null
}

function sizeUrl(sizes: MediaSizesJson | null | undefined, name: MediaSizeName): string | undefined {
  if (!sizes || typeof sizes !== 'object') return undefined
  const entry = sizes[name]
  if (!entry || typeof entry !== 'object') return undefined
  const url = typeof entry.url === 'string' ? entry.url.trim() : ''
  return url || undefined
}

function isPng(media: MediaUrlSource): boolean {
  const mime = (media.mimeType ?? '').toLowerCase()
  if (mime === 'image/png') return true
  const name = (media.filename ?? '').toLowerCase()
  return name.endsWith('.png')
}

/**
 * Prefer WebP derivative for photos; keep original URL for logos / PNG.
 */
export function preferredMediaUrl(
  media: MediaUrlSource,
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
  media: MediaDoc,
  opts?: { size?: MediaSizeName; preferWebp?: boolean },
): ResolvedMedia | null {
  const url = preferredMediaUrl(media, opts)
  if (!url) return null
  const absolute = absoluteAssetUrl(url) || url
  const originalUrl = media.url?.trim() || undefined
  return {
    id: media.id,
    alt: media.alt || '',
    url,
    absoluteUrl: absolute,
    ...(originalUrl ? { originalUrl } : {}),
    mimeType: media.mimeType,
    width: media.width,
    height: media.height,
    folder: media.folder ?? null,
    categoryId: media.categoryId,
    categoryLabel: media.categoryLabel,
    purpose: (media.purpose as MediaPurpose | null | undefined) ?? null,
    filename: media.filename,
    private: media.private === true,
    ...(media.tagIds.length ? { tagIds: media.tagIds } : {}),
    ...(media.tagLabels.length ? { tagLabels: media.tagLabels } : {}),
    sizes: {
      thumbnail: sizeUrl(media.sizes, 'thumbnail'),
      card: sizeUrl(media.sizes, 'card'),
      large: sizeUrl(media.sizes, 'large'),
    },
  }
}

function fallbackResolved(media: MediaDoc): ResolvedMedia {
  const originalUrl = media.url?.trim() || ''
  return {
    id: media.id,
    alt: media.alt || '',
    url: originalUrl,
    absoluteUrl: absoluteAssetUrl(originalUrl) || originalUrl,
    ...(originalUrl ? { originalUrl } : {}),
    mimeType: media.mimeType,
    width: media.width,
    height: media.height,
    folder: media.folder ?? null,
    categoryId: media.categoryId,
    categoryLabel: media.categoryLabel,
    purpose: (media.purpose as MediaPurpose | null | undefined) ?? null,
    filename: media.filename,
    private: media.private === true,
    ...(media.tagIds.length ? { tagIds: media.tagIds } : {}),
    ...(media.tagLabels.length ? { tagLabels: media.tagLabels } : {}),
  }
}

/** Load an asset by id. */
export async function findMediaById(id: string | number): Promise<MediaDoc | null> {
  const raw = String(id ?? '').trim()
  if (!raw) return null
  try {
    return await getMediaAsset(raw)
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

/** List media-tags for library facets. */
export async function listMediaTagOptions(): Promise<MediaTagOption[]> {
  try {
    const rows = await listTagRows()
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      slug: row.slug,
    }))
  } catch {
    return []
  }
}

/** List media for admin library / picker. */
export async function listMedia(opts?: {
  /** Nested category id. Prefer over folder when both set. */
  category?: string
  /** Legacy flat folder — used when category unset. */
  folder?: string
  purpose?: string
  /** Tag id(s) — single or comma-separated. */
  tag?: string
  /** Tag match mode when multiple ids (default OR). */
  tagMode?: MediaTagMatchMode | string
  q?: string
  limit?: number
  page?: number
}): Promise<{
  docs: ResolvedMedia[]
  totalDocs: number
  page: number
  totalPages: number
}> {
  const limit = Math.min(Math.max(opts?.limit ?? 48, 1), 100)
  const page = Math.max(opts?.page ?? 1, 1)
  const tagFilter = parseMediaTagFilter(opts?.tag, opts?.tagMode)
  const { docs: rows, total } = await listMediaAssets({
    category: opts?.category,
    folder: opts?.folder,
    purpose: opts?.purpose,
    tagIds: tagFilter.ids,
    tagMode: tagFilter.mode,
    q: opts?.q,
    limit,
    offset: (page - 1) * limit,
  })

  const docs: ResolvedMedia[] = []
  for (const row of rows) {
    const resolved = toResolvedMedia(row, { size: 'thumbnail', preferWebp: true })
    docs.push(resolved ?? fallbackResolved(row))
  }

  return {
    docs,
    totalDocs: total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  }
}
