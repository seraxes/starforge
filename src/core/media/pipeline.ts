/**
 * Starforge media pipeline defaults (SF-28 / SF-117 / SF-148).
 * Applied around Payload Media upload — one library for all features.
 * Image engine = sharp (libvips) only — no GD / Imagick / Jimp.
 * Editable under Core admin → Media → Settings (`sf_media_settings`).
 */

/** Per-group upload encode mode — missing group id means force (automated). */
export type MediaEncodeGroupMode = 'force' | 'choose'

/** Viewer-facing encode choice after resolving group maps + app-admin bypass. */
export type MediaEncodePolicy = {
  canChooseDecode: boolean
  canChooseResize: boolean
}

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
  /** When purpose=logo, keep PNG originals (resize only) and skip forced WebP for JPEG. */
  keepPngForLogos: boolean
  /**
   * Per user-group decode policy (`force` = always WebP for photos; `choose` = upload toggle).
   * Missing id → force. App admins always choose.
   */
  decodeByGroup: Record<string, MediaEncodeGroupMode>
  /**
   * Per user-group resize policy (`force` = always max W×H; `choose` = upload toggle).
   * Missing id → force. App admins always choose.
   */
  resizeByGroup: Record<string, MediaEncodeGroupMode>
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
  decodeByGroup: {},
  resizeByGroup: {},
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

export function isMediaEncodeGroupMode(raw: unknown): raw is MediaEncodeGroupMode {
  return raw === 'force' || raw === 'choose'
}

/** Normalize a group-id → force|choose map (invalid keys/values dropped). */
export function normalizeMediaEncodeGroupMap(raw: unknown): Record<string, MediaEncodeGroupMode> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, MediaEncodeGroupMode> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const id = key.trim()
    if (!id || !isMediaEncodeGroupMode(value)) continue
    out[id] = value
  }
  return out
}

/**
 * Resolve whether the viewer may turn off decode / resize on upload.
 * App admin → always choose. Else any listed group with `choose` wins. Else force.
 */
export function resolveMediaEncodePolicy(
  viewer: { isAppAdmin: boolean; groupIds: string[] },
  rules: Pick<MediaPipelineRules, 'decodeByGroup' | 'resizeByGroup'>,
): MediaEncodePolicy {
  if (viewer.isAppAdmin) {
    return { canChooseDecode: true, canChooseResize: true }
  }
  let canChooseDecode = false
  let canChooseResize = false
  for (const gid of viewer.groupIds) {
    if (rules.decodeByGroup[gid] === 'choose') canChooseDecode = true
    if (rules.resizeByGroup[gid] === 'choose') canChooseResize = true
  }
  return { canChooseDecode, canChooseResize }
}

/**
 * Clamp client-posted encode flags against policy.
 * Forced viewers always get true; choosers keep the posted boolean (default on when absent only if forced).
 */
export function clampMediaEncodeFlags(
  policy: MediaEncodePolicy,
  posted: { decodeToWebp?: boolean | null; resize?: boolean | null },
): { decodeToWebp: boolean; resize: boolean } {
  return {
    decodeToWebp: policy.canChooseDecode ? Boolean(posted.decodeToWebp) : true,
    resize: policy.canChooseResize ? Boolean(posted.resize) : true,
  }
}

/** Merge/clamp partial rules onto defaults (safe for DB JSON + form posts). */
export function normalizeMediaPipelineRules(raw: unknown): MediaPipelineRules {
  const base = DEFAULT_MEDIA_PIPELINE_RULES
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      ...base,
      decodeByGroup: {},
      resizeByGroup: {},
      sizes: { ...base.sizes },
    }
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
    decodeByGroup: normalizeMediaEncodeGroupMap(row.decodeByGroup),
    resizeByGroup: normalizeMediaEncodeGroupMap(row.resizeByGroup),
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
