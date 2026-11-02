/**
 * Starforge media pipeline defaults (SF-28).
 * Applied around Payload Media upload — one library for all features.
 */

/** Max edge for original uploads (without enlargement). */
export const MEDIA_MAX_WIDTH = 2560
export const MEDIA_MAX_HEIGHT = 2560

/** JPEG quality for originals when Payload formats as jpeg. */
export const MEDIA_JPEG_QUALITY = 82

/** WebP quality for generated sizes. */
export const MEDIA_WEBP_QUALITY = 80

/** Thumbnail edge (square crop for admin / picker). */
export const MEDIA_THUMB_SIZE = 320

/** Card / content width. */
export const MEDIA_CARD_WIDTH = 768

/** Large / hero width. */
export const MEDIA_LARGE_WIDTH = 1920

export const MEDIA_FOLDERS = [
  { value: 'general', label: 'General' },
  { value: 'logos', label: 'Logos' },
  { value: 'backgrounds', label: 'Backgrounds' },
  { value: 'pages', label: 'Pages' },
  { value: 'forms', label: 'Forms' },
] as const

export type MediaFolder = (typeof MEDIA_FOLDERS)[number]['value']

export const MEDIA_PURPOSES = [
  { value: 'photo', label: 'Photo' },
  { value: 'logo', label: 'Logo' },
  { value: 'other', label: 'Other' },
] as const

export type MediaPurpose = (typeof MEDIA_PURPOSES)[number]['value']

export function isMediaFolder(raw: unknown): raw is MediaFolder {
  return typeof raw === 'string' && MEDIA_FOLDERS.some((f) => f.value === raw)
}

export function isMediaPurpose(raw: unknown): raw is MediaPurpose {
  return typeof raw === 'string' && MEDIA_PURPOSES.some((p) => p.value === raw)
}

export function normalizeMediaFolder(raw: unknown): MediaFolder {
  return isMediaFolder(raw) ? raw : 'general'
}

export function normalizeMediaPurpose(raw: unknown): MediaPurpose {
  return isMediaPurpose(raw) ? raw : 'photo'
}
