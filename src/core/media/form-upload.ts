/**
 * Public Form file → Payload Media (single library, private intake).
 * Used by submitFormAction — no admin session required for *create*.
 * Reads stay admin-gated (folder=forms + private flag).
 */

import 'server-only'

import { getPayload } from 'payload'

import config from '@payload-config'

import { normalizeMediaFolder } from './pipeline'
import { getMediaStorageInfo } from './storage'
import { toResolvedMedia, type ResolvedMedia } from './resolve'

export { isPrivateFormMedia } from './privacy'

/** Default max attachment size (10 MiB). Keep in sync with next.config serverActions.bodySizeLimit. */
export const FORM_FILE_DEFAULT_MAX_BYTES = 10 * 1024 * 1024

/**
 * Absolute ceiling for any Form file field (definition cannot raise above this).
 * Also the value that Next `serverActions.bodySizeLimit` must meet or exceed.
 */
export const FORM_FILE_HARD_MAX_BYTES = FORM_FILE_DEFAULT_MAX_BYTES

/** Default HTML accept when the field leaves accept empty. SVG is never allowed. */
export const FORM_FILE_DEFAULT_ACCEPT =
  'image/png,image/jpeg,image/gif,image/webp,application/pdf,text/plain,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

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
}

/** Built-in allowlist for anonymous Form uploads — no SVG (stored XSS). */
const BUILTIN_ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

const BLOCKED_EXT = new Set(['.svg', '.svgz'])
const BLOCKED_MIME = new Set(['image/svg+xml', 'image/svg'])

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
    const lower = token.toLowerCase()
    if (lower === 'image/svg+xml' || lower === '.svg' || lower === '.svgz') {
      continue
    }
    if (token.endsWith('/*')) {
      // image/* would otherwise admit SVG — narrow to raster only.
      if (lower === 'image/*') {
        for (const m of ['image/png', 'image/jpeg', 'image/gif', 'image/webp']) {
          mimes.add(m)
        }
        continue
      }
      wildcards.push(token.slice(0, -1).toLowerCase())
    } else if (token.startsWith('.')) {
      if (!BLOCKED_EXT.has(lower)) exts.add(lower)
    } else if (!BLOCKED_MIME.has(lower)) {
      mimes.add(lower)
    }
  }
  return { wildcards, mimes, exts }
}

function fileExt(fileName: string): string {
  const name = (fileName || '').toLowerCase()
  return name.includes('.') ? `.${name.split('.').pop()}` : ''
}

export function isFormUploadSvgBlocked(mimeType: string, fileName: string): boolean {
  const mime = (mimeType || '').toLowerCase()
  const ext = fileExt(fileName)
  return BLOCKED_MIME.has(mime) || BLOCKED_EXT.has(ext)
}

/**
 * Clamp definition-configured max to the hard ceiling (never trust a huge client/def value).
 */
export function clampFormUploadMaxBytes(maxSizeBytes?: number): number {
  if (
    typeof maxSizeBytes !== 'number' ||
    !Number.isFinite(maxSizeBytes) ||
    maxSizeBytes <= 0
  ) {
    return FORM_FILE_DEFAULT_MAX_BYTES
  }
  return Math.min(Math.floor(maxSizeBytes), FORM_FILE_HARD_MAX_BYTES)
}

export function isFormUploadMimeAllowed(
  mimeType: string,
  fileName: string,
  accept?: string,
): boolean {
  if (isFormUploadSvgBlocked(mimeType, fileName)) return false

  const mime = (mimeType || '').toLowerCase()
  const ext = fileExt(fileName)
  const { wildcards, mimes, exts } = parseAcceptList(accept)

  // Always require membership in the built-in allowlist (server definition cannot widen to SVG / exe).
  const builtinOk =
    (mime && BUILTIN_ALLOWED_MIME.has(mime)) ||
    (ext && EXT_MIME[ext]?.some((m) => BUILTIN_ALLOWED_MIME.has(m)))
  if (!builtinOk) return false

  if (exts.size && ext && exts.has(ext)) return true
  if (mimes.size && mime && mimes.has(mime)) return true
  if (wildcards.length && mime) {
    if (wildcards.some((w) => mime.startsWith(w))) return true
  }
  // When accept is empty we already used defaults; gate against built-in set.
  if (!accept || !accept.trim()) {
    return true
  }
  // Extension ↔ mime fallback for browsers that send empty type.
  if (ext && EXT_MIME[ext]) {
    const allowed = EXT_MIME[ext]!
    if (!mime || allowed.includes(mime)) {
      if (exts.has(ext)) return true
      if (allowed.some((m) => mimes.has(m) || wildcards.some((w) => m.startsWith(w)))) {
        return true
      }
    }
  }
  return false
}

/**
 * Validate a respondent File against server field limits *without* storing it.
 */
export function validateFormUploadFile(options: {
  file: File
  accept?: string
  maxSizeBytes?: number
}): { ok: true } | { ok: false; error: string } {
  const file = options.file
  if (!(file instanceof File) || file.size <= 0) {
    return { ok: false, error: 'Choose a file to upload.' }
  }
  if (isFormUploadSvgBlocked(file.type, file.name)) {
    return { ok: false, error: 'SVG uploads are not allowed.' }
  }
  const maxBytes = clampFormUploadMaxBytes(options.maxSizeBytes)
  if (file.size > maxBytes) {
    const mb = Math.round((maxBytes / (1024 * 1024)) * 10) / 10
    return { ok: false, error: `File is too large (max ${mb} MB).` }
  }
  if (!isFormUploadMimeAllowed(file.type, file.name, options.accept)) {
    return { ok: false, error: 'That file type is not allowed.' }
  }
  return { ok: true }
}

export type FormMediaUploadResult =
  | { ok: true; mediaId: string; media?: ResolvedMedia }
  | { ok: false; error: string }

/**
 * Store a respondent file in Payload Media (folder=forms, private=true).
 * Caller must already have passed captcha + field validation.
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

  const checked = validateFormUploadFile(options)
  if (!checked.ok) return checked

  const file = options.file

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
        private: true,
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
