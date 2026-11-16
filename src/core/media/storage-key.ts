/**
 * Storage keys mirror media categories on local disk and on S3.
 * `logos/events/photo.webp` is the original. Generated sizes live at
 * `logos/events/_derivatives/photo-thumbnail.webp`.
 * Client-safe: no filesystem, no `server-only`.
 */

/** Sidecar folder under each category prefix. Not a category. */
export const MEDIA_DERIVATIVES_DIR = '_derivatives'

/** No category, or an unknown id, lands in this prefix. */
export const MEDIA_GENERAL_PREFIX = 'general'

/**
 * Relative object key. Slashes are category segments.
 * Rejects empty segments, `.`, `..`, backslashes, and absolute paths.
 */
export function assertSafeMediaKey(key: string): string {
  const raw = String(key ?? '').trim()
  if (!raw || raw.startsWith('/') || raw.endsWith('/') || raw.includes('\\') || raw.includes('\0')) {
    throw new Error('Invalid media storage key.')
  }
  const parts = raw.split('/')
  for (const part of parts) {
    if (!part || part === '.' || part === '..') {
      throw new Error('Invalid media storage key.')
    }
  }
  return parts.join('/')
}

export function encodeStorageKeyPath(key: string): string {
  return assertSafeMediaKey(key)
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')
}

/** Site-relative URL. Slashes stay as path segments so nested keys resolve. */
export function mediaPublicFileUrl(key: string): string {
  return `/api/media/file/${encodeStorageKeyPath(key)}`
}

export function basenameOfStorageKey(key: string): string {
  const parts = String(key ?? '').split('/')
  return parts[parts.length - 1] || ''
}

/** Slug chain from the category root down to the leaf. Empty → `general`. */
export function storagePrefixFromChain(slugs: string[]): string {
  const parts: string[] = []
  for (const slug of slugs) {
    const segment = String(slug ?? '').trim()
    if (!segment || segment.includes('/') || segment.includes('\\') || segment === '.' || segment === '..') {
      continue
    }
    parts.push(segment)
  }
  return parts.length ? parts.join('/') : MEDIA_GENERAL_PREFIX
}

export function joinStorageKey(prefix: string, filename: string): string {
  const name = basenameOfStorageKey(filename)
  const dir = String(prefix ?? '').trim().replace(/\/+$/g, '')
  return assertSafeMediaKey(dir ? `${dir}/${name}` : name)
}

export function derivativeStorageKey(prefix: string, filename: string): string {
  const name = basenameOfStorageKey(filename)
  const dir = String(prefix ?? '').trim().replace(/\/+$/g, '')
  const base = dir
    ? `${dir}/${MEDIA_DERIVATIVES_DIR}/${name}`
    : `${MEDIA_DERIVATIVES_DIR}/${name}`
  return assertSafeMediaKey(base)
}

/** True when `key` is already the original at `prefix` (not a derivative). */
export function originalKeyMatchesPrefix(key: string, prefix: string): boolean {
  const safePrefix = String(prefix ?? '').trim().replace(/\/+$/g, '')
  if (!key || !safePrefix) return false
  if (key === safePrefix) return false
  if (!key.startsWith(`${safePrefix}/`)) return false
  const rest = key.slice(safePrefix.length + 1)
  return rest.length > 0 && !rest.includes('/') && !rest.startsWith('.')
}
