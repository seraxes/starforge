/**
 * Admin library file kinds (phase 2a).
 * Images stay as they are today. Documents match the Forms built-in allowlist
 * (PDF, Word, plain text) — see `FORM_FILE_DEFAULT_ACCEPT` in form-upload.ts.
 * Client-safe: no Payload, no `server-only`.
 */

import { isPrivateFormMedia } from './privacy'

/** Page size for `/admin/media`. The list pages past this; Payload's cap stays higher. */
export const MEDIA_LIBRARY_PAGE_SIZE = 60

/**
 * Admin library `<input accept>`. `image/*` keeps today's image uploads.
 * Document tokens match Forms (SVG is never included).
 */
export const ADMIN_LIBRARY_ACCEPT =
  'image/*,application/pdf,text/plain,.txt,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

const DOC_MIME = new Set([
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

const EXT_MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
}

const IMAGE_EXT = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.avif',
  '.bmp',
  '.tif',
  '.tiff',
])

function fileExt(fileName: string): string {
  const name = (fileName || '').toLowerCase()
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot) : ''
}

export function isSvgUpload(mimeType: string, fileName: string): boolean {
  const mime = (mimeType || '').toLowerCase()
  const ext = fileExt(fileName)
  return mime === 'image/svg+xml' || mime === 'image/svg' || ext === '.svg' || ext === '.svgz'
}

/** Best MIME when the browser sends an empty or generic type. */
export function resolveAdminLibraryMime(mimeType: string, fileName: string): string {
  const mime = (mimeType || '').toLowerCase()
  if (mime && mime !== 'application/octet-stream') return mime
  return EXT_MIME[fileExt(fileName)] || mime || 'application/octet-stream'
}

/**
 * Admin library allow check.
 * `documents: false` (MediaPicker) keeps image-only uploads.
 * `documents: true` (`/admin/media`) also allows the Forms document types.
 */
export function isAdminLibraryUploadAllowed(
  mimeType: string,
  fileName: string,
  opts?: { documents?: boolean },
): boolean {
  if (isSvgUpload(mimeType, fileName)) return false
  const mime = resolveAdminLibraryMime(mimeType, fileName)
  const ext = fileExt(fileName)
  if (DOC_MIME.has(mime)) return Boolean(opts?.documents)
  if (mime.startsWith('image/')) return true
  if (IMAGE_EXT.has(ext)) return true
  if (!opts?.documents) return false
  const mapped = EXT_MIME[ext]
  return Boolean(mapped && DOC_MIME.has(mapped))
}

export type MediaLibraryPreviewKind = 'image' | 'pdf' | 'doc' | 'text' | 'file'

/** How the library card / lightbox should render a file. SVG is never an `<img>`. */
export function mediaLibraryPreviewKind(
  mimeType?: string | null,
  fileName?: string | null,
): MediaLibraryPreviewKind {
  const mime = (mimeType || '').toLowerCase()
  const name = fileName || ''
  const ext = fileExt(name)
  if (isSvgUpload(mime, name)) return 'file'
  if (mime === 'application/pdf' || ext === '.pdf') return 'pdf'
  if (mime === 'text/plain' || ext === '.txt') return 'text'
  if (
    mime === 'application/msword' ||
    mime ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext === '.doc' ||
    ext === '.docx'
  ) {
    return 'doc'
  }
  if (mime.startsWith('image/') || IMAGE_EXT.has(ext)) return 'image'
  return 'file'
}

/**
 * App-admin URL for private / form files. Public files return null so callers
 * keep the Payload asset URL. `inline` asks the attachment route to display
 * images and PDFs instead of forcing a download. SVG stays an attachment.
 */
export function mediaAdminFileHref(
  doc: { id: string; folder?: string | null; private?: boolean | null },
  opts?: { inline?: boolean },
): string | null {
  if (!isPrivateFormMedia(doc)) return null
  const q = opts?.inline ? '?inline=1' : ''
  return `/api/admin/form-attachments/${encodeURIComponent(doc.id)}${q}`
}
