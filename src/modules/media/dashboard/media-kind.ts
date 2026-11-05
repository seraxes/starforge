/**
 * Mime → Dashboard Media kind buckets.
 * Mirrors library mime taxonomy (images / audio / video / docs / other) —
 * purpose (logo/photo/other) is orthogonal and not used for kind totals.
 */

export const MEDIA_KIND_KEYS = ['images', 'audio', 'video', 'docs', 'other'] as const

export type MediaKindKey = (typeof MEDIA_KIND_KEYS)[number]

const DOC_MIME_EXACT = new Set([
  'application/pdf',
  'application/msword',
  'application/rtf',
  'application/epub+zip',
  'text/plain',
  'text/csv',
  'text/rtf',
  'text/markdown',
  'text/html',
])

const DOC_MIME_PREFIXES = [
  'application/vnd.openxmlformats-officedocument.',
  'application/vnd.ms-',
  'text/',
] as const

/** True when mime is a document-like type (PDF, Office, plain text, …). */
export function isMediaDocMime(mimeType: string | null | undefined): boolean {
  const mime = (mimeType || '').toLowerCase().trim()
  if (!mime) return false
  if (DOC_MIME_EXACT.has(mime)) return true
  return DOC_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix))
}

/** Classify a Payload Media `mime_type` into a Dashboard kind bucket. */
export function classifyMediaMimeKind(mimeType: string | null | undefined): MediaKindKey {
  const mime = (mimeType || '').toLowerCase().trim()
  if (mime.startsWith('image/')) return 'images'
  if (mime.startsWith('audio/')) return 'audio'
  if (mime.startsWith('video/')) return 'video'
  if (isMediaDocMime(mime)) return 'docs'
  return 'other'
}

/** Zeroed kind totals (empty library / soft aggregate seed). */
export function emptyMediaKindCounts(): Record<MediaKindKey, number> {
  return {
    images: 0,
    audio: 0,
    video: 0,
    docs: 0,
    other: 0,
  }
}

/** Fold mime-grouped SQL rows into kind totals. */
export function aggregateMediaKindCounts(
  rows: ReadonlyArray<{ mimeType: string | null | undefined; n: number }>,
): Record<MediaKindKey, number> {
  const byKind = emptyMediaKindCounts()
  for (const row of rows) {
    const key = classifyMediaMimeKind(row.mimeType)
    byKind[key] += Number(row.n) || 0
  }
  return byKind
}
