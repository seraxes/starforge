/**
 * Public Form file → Payload Media (single library).
 * Used by submitFormAction — no admin session required.
 */

import 'server-only'

import { getPayload } from 'payload'

import config from '@payload-config'

import { normalizeMediaFolder } from './pipeline'
import { getMediaStorageInfo } from './storage'
import { toResolvedMedia, type ResolvedMedia } from './resolve'

/** Default max attachment size (10 MiB). */
export const FORM_FILE_DEFAULT_MAX_BYTES = 10 * 1024 * 1024

/** Default HTML accept when the field leaves accept empty. */
export const FORM_FILE_DEFAULT_ACCEPT =
  'image/*,application/pdf,text/plain,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

const EXT_MIME: Record<string, string[]> = {
  '.pdf': ['application/pdf'],
  '.txt': ['text/plain'],
  '.doc': ['application/msword'],
  '.docx': [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  '.png': ['image/png'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.gif': ['image/gif'],
  '.webp': ['image/webp'],
  '.svg': ['image/svg+xml'],
}

const BUILTIN_ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

function parseAcceptList(accept: string | undefined): {
  wildcards: string[]
  mimes: Set<string>
  exts: Set<string>
} {
  const raw = (accept || FORM_FILE_DEFAULT_ACCEPT).split(',').map((s) => s.trim()).filter(Boolean)
  const wildcards: string[] = []
  const mimes = new Set<string>()
  const exts = new Set<string>()
  for (const token of raw) {
    if (token.endsWith('/*')) {
      wildcards.push(token.slice(0, -1).toLowerCase())
    } else if (token.startsWith('.')) {
      exts.add(token.toLowerCase())
    } else {
      mimes.add(token.toLowerCase())
    }
  }
  return { wildcards, mimes, exts }
}

export function isFormUploadMimeAllowed(
  mimeType: string,
  fileName: string,
  accept?: string,
): boolean {
  const mime = (mimeType || '').toLowerCase()
  const name = (fileName || '').toLowerCase()
  const ext = name.includes('.') ? `.${name.split('.').pop()}` : ''
  const { wildcards, mimes, exts } = parseAcceptList(accept)

  if (exts.size && ext && exts.has(ext)) return true
  if (mimes.size && mime && mimes.has(mime)) return true
  if (wildcards.length && mime) {
    if (wildcards.some((w) => mime.startsWith(w))) return true
  }
  // When accept is empty we already used defaults; still gate against built-in set.
  if (!accept || !accept.trim()) {
    if (mime && BUILTIN_ALLOWED_MIME.has(mime)) return true
    if (ext && EXT_MIME[ext]?.some((m) => BUILTIN_ALLOWED_MIME.has(m))) return true
  }
  // Extension ↔ mime fallback for browsers that send empty type.
  if (ext && EXT_MIME[ext]) {
    const allowed = EXT_MIME[ext]!
    if (!mime || allowed.includes(mime)) {
      if (!accept || !accept.trim()) return true
      if (exts.has(ext)) return true
      if (allowed.some((m) => mimes.has(m) || wildcards.some((w) => m.startsWith(w)))) {
        return true
      }
    }
  }
  return false
}

export type FormMediaUploadResult =
  | { ok: true; mediaId: string; media?: ResolvedMedia }
  | { ok: false; error: string }

/**
 * Store a respondent file in Payload Media (folder=forms). Returns media id for the payload.
 */
export async function uploadFormAttachmentToMedia(options: {
  file: File
  accept?: string
  maxSizeBytes?: number
  alt?: string
}): Promise<FormMediaUploadResult> {
  const storage = getMediaStorageInfo()
  if (!storage.ready) {
    return { ok: false, error: storage.detail || 'Media storage is not ready.' }
  }

  const file = options.file
  if (!(file instanceof File) || file.size <= 0) {
    return { ok: false, error: 'Choose a file to upload.' }
  }

  const maxBytes = options.maxSizeBytes ?? FORM_FILE_DEFAULT_MAX_BYTES
  if (file.size > maxBytes) {
    const mb = Math.round((maxBytes / (1024 * 1024)) * 10) / 10
    return { ok: false, error: `File is too large (max ${mb} MB).` }
  }

  if (!isFormUploadMimeAllowed(file.type, file.name, options.accept)) {
    return { ok: false, error: 'That file type is not allowed.' }
  }

  try {
    const payload = await getPayload({ config })
    const data = Buffer.from(await file.arrayBuffer())
    const name = file.name || `form-upload-${Date.now()}`
    const alt =
      options.alt?.trim() ||
      name.replace(/\.[^.]+$/, '') ||
      'Form attachment'
    const mime = file.type || 'application/octet-stream'

    const doc = await payload.create({
      collection: 'media',
      data: {
        alt,
        folder: normalizeMediaFolder('forms'),
        purpose: 'other',
      },
      file: {
        data,
        mimetype: mime,
        name,
        size: data.length,
      },
      overrideAccess: true,
    })

    const media = toResolvedMedia(doc as Parameters<typeof toResolvedMedia>[0], {
      preferWebp: false,
    })
    return {
      ok: true,
      mediaId: String(doc.id),
      ...(media ? { media } : {}),
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Upload failed.',
    }
  }
}
