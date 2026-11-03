/**
 * Starforge media pipeline defaults (SF-28 / SF-117 / SF-148).
 * Applied around Payload Media upload — one library for all features.
 * Image engine = sharp only; video = ffmpeg later (not here).
 * Editable under Core admin → Media → Settings (`sf_media_settings`).
 */

/** Typed image rules — Core Media Settings; code defaults when unset. */
export type MediaPipelineRules = {
  /** Cap longest edges on originals (no enlargement). */
  maxWidth: number
  maxHeight: number
  /** JPEG re-encode when keeping JPEG (e.g. logo JPEG). */
  jpegQuality: number
  /** WebP quality for photo originals + Payload size derivatives. */
  webpQuality: number
  /** Photo / other originals: always WebP (default). */
  photoOriginalFormat: 'webp'
  /** PNG mime always kept; purpose=logo also skips forced WebP. */
  keepPngForLogos: boolean
  sizes: {
    thumbnail: number
    card: number
    large: number
  }
}

export const DEFAULT_MEDIA_PIPELINE_RULES: MediaPipelineRules = {
  maxWidth: 2560,
  maxHeight: 2560,
  jpegQuality: 82,
  webpQuality: 80,
  photoOriginalFormat: 'webp',
  keepPngForLogos: true,
  sizes: {
    thumbnail: 320,
    card: 768,
    large: 1920,
  },
}

/** Inclusive bounds for Media Settings form + normalize. */
export const MEDIA_PIPELINE_MAX_EDGE_MIN = 320
export const MEDIA_PIPELINE_MAX_EDGE_MAX = 8192
export const MEDIA_PIPELINE_QUALITY_MIN = 1
export const MEDIA_PIPELINE_QUALITY_MAX = 100

function clampInt(raw: unknown, min: number, max: number, fallback: number): number {
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

/** Merge/clamp partial rules onto defaults (safe for DB JSON + form posts). */
export function normalizeMediaPipelineRules(raw: unknown): MediaPipelineRules {
  const base = DEFAULT_MEDIA_PIPELINE_RULES
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...base, sizes: { ...base.sizes } }
  }
  const row = raw as Record<string, unknown>
  const sizesRaw =
    row.sizes && typeof row.sizes === 'object' && !Array.isArray(row.sizes)
      ? (row.sizes as Record<string, unknown>)
      : {}
  return {
    maxWidth: clampInt(
      row.maxWidth,
      MEDIA_PIPELINE_MAX_EDGE_MIN,
      MEDIA_PIPELINE_MAX_EDGE_MAX,
      base.maxWidth,
    ),
    maxHeight: clampInt(
      row.maxHeight,
      MEDIA_PIPELINE_MAX_EDGE_MIN,
      MEDIA_PIPELINE_MAX_EDGE_MAX,
      base.maxHeight,
    ),
    jpegQuality: clampInt(
      row.jpegQuality,
      MEDIA_PIPELINE_QUALITY_MIN,
      MEDIA_PIPELINE_QUALITY_MAX,
      base.jpegQuality,
    ),
    webpQuality: clampInt(
      row.webpQuality,
      MEDIA_PIPELINE_QUALITY_MIN,
      MEDIA_PIPELINE_QUALITY_MAX,
      base.webpQuality,
    ),
    photoOriginalFormat: 'webp',
    keepPngForLogos:
      typeof row.keepPngForLogos === 'boolean'
        ? row.keepPngForLogos
        : row.keepPngForLogos === 'off' || row.keepPngForLogos === '0' || row.keepPngForLogos === 0
          ? false
          : base.keepPngForLogos,
    sizes: {
      thumbnail: clampInt(
        sizesRaw.thumbnail,
        MEDIA_PIPELINE_MAX_EDGE_MIN,
        MEDIA_PIPELINE_MAX_EDGE_MAX,
        base.sizes.thumbnail,
      ),
      card: clampInt(
        sizesRaw.card,
        MEDIA_PIPELINE_MAX_EDGE_MIN,
        MEDIA_PIPELINE_MAX_EDGE_MAX,
        base.sizes.card,
      ),
      large: clampInt(
        sizesRaw.large,
        MEDIA_PIPELINE_MAX_EDGE_MIN,
        MEDIA_PIPELINE_MAX_EDGE_MAX,
        base.sizes.large,
      ),
    },
  }
}

/** Max edge for original uploads (without enlargement). */
export const MEDIA_MAX_WIDTH = DEFAULT_MEDIA_PIPELINE_RULES.maxWidth
export const MEDIA_MAX_HEIGHT = DEFAULT_MEDIA_PIPELINE_RULES.maxHeight

/** JPEG quality for originals when Payload formats as jpeg. */
export const MEDIA_JPEG_QUALITY = DEFAULT_MEDIA_PIPELINE_RULES.jpegQuality

/** WebP quality for generated sizes. */
export const MEDIA_WEBP_QUALITY = DEFAULT_MEDIA_PIPELINE_RULES.webpQuality

/** Thumbnail edge (square crop for admin / picker). */
export const MEDIA_THUMB_SIZE = DEFAULT_MEDIA_PIPELINE_RULES.sizes.thumbnail

/** Card / content width. */
export const MEDIA_CARD_WIDTH = DEFAULT_MEDIA_PIPELINE_RULES.sizes.card

/** Large / hero width. */
export const MEDIA_LARGE_WIDTH = DEFAULT_MEDIA_PIPELINE_RULES.sizes.large

/**
 * Legacy flat folder buckets. Phase 2 browse uses nested Categories;
 * keep these for Form privacy (`forms`), Payload select, and seed/migrate.
 */
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
