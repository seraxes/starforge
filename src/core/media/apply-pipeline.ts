/**
 * Shared sharp apply for Core upload + Media `beforeChange` (SF-117 / SF-148).
 * One image engine — do not add Imagick / Jimp / GD / second decoder.
 */

import sharp from 'sharp'

import {
  DEFAULT_MEDIA_PIPELINE_RULES,
  normalizeMediaPurpose,
  type MediaPipelineRules,
  type MediaPurpose,
} from './pipeline'

export type ApplyMediaPipelineInput = {
  buffer: Buffer
  mimeType: string
  purpose?: MediaPurpose | string | null
  rules?: MediaPipelineRules
  /** Convert PNG/JPEG (and other photo rasters) to WebP. Default true. */
  decodeToWebp?: boolean
  /** Cap longest edge to rules max W×H. Default true. */
  resize?: boolean
}

export type ApplyMediaPipelineResult = {
  data: Buffer
  mimetype: string
  /** Suggested filename extension when format changed (no leading dot). */
  extHint?: string
}

/**
 * Cap longest edge; logo PNG/JPEG stay source format when keepPngForLogos;
 * photos → WebP when decodeToWebp. Non-images pass through unchanged.
 */
export async function applyMediaPipelineRules(
  input: ApplyMediaPipelineInput,
): Promise<ApplyMediaPipelineResult> {
  const rules = input.rules ?? DEFAULT_MEDIA_PIPELINE_RULES
  const mime = (input.mimeType || '').toLowerCase()
  const purpose = normalizeMediaPurpose(input.purpose)
  const decodeToWebp = input.decodeToWebp !== false
  const allowResize = input.resize !== false

  if (!mime.startsWith('image/')) {
    return { data: input.buffer, mimetype: input.mimeType || 'application/octet-stream' }
  }

  const image = sharp(input.buffer).rotate()
  const meta = await image.metadata()
  const width = meta.width ?? rules.maxWidth
  const height = meta.height ?? rules.maxHeight
  const needsResize = allowResize && (width > rules.maxWidth || height > rules.maxHeight)
  let pipeline = image
  if (needsResize) {
    pipeline = pipeline.resize({
      width: rules.maxWidth,
      height: rules.maxHeight,
      fit: 'inside',
      withoutEnlargement: true,
    })
  }

  // Logo PNG: keep PNG (resize only) when the settings flag is on.
  if (mime === 'image/png' && rules.keepPngForLogos && purpose === 'logo') {
    const data = await pipeline.png().toBuffer()
    return { data, mimetype: 'image/png' }
  }

  // Logo JPEG: re-encode JPEG only (no forced WebP).
  if (purpose === 'logo' && (mime === 'image/jpeg' || mime === 'image/jpg')) {
    const data = await pipeline.jpeg({ quality: rules.jpegQuality, mozjpeg: true }).toBuffer()
    return { data, mimetype: 'image/jpeg', extHint: 'jpg' }
  }

  // Logo WebP: keep WebP (resize only).
  if (purpose === 'logo' && mime === 'image/webp') {
    const data = await pipeline.webp({ quality: rules.webpQuality }).toBuffer()
    return { data, mimetype: 'image/webp', extHint: 'webp' }
  }

  // Uploader turned decode off — keep source format (re-encode after rotate/resize).
  if (!decodeToWebp) {
    if (mime === 'image/png') {
      const data = await pipeline.png().toBuffer()
      return { data, mimetype: 'image/png', extHint: 'png' }
    }
    if (mime === 'image/jpeg' || mime === 'image/jpg') {
      const data = await pipeline.jpeg({ quality: rules.jpegQuality, mozjpeg: true }).toBuffer()
      return { data, mimetype: 'image/jpeg', extHint: 'jpg' }
    }
    if (mime === 'image/webp') {
      const data = await pipeline.webp({ quality: rules.webpQuality }).toBuffer()
      return { data, mimetype: 'image/webp', extHint: 'webp' }
    }
    if (mime === 'image/gif') {
      const data = await pipeline.gif().toBuffer()
      return { data, mimetype: 'image/gif', extHint: 'gif' }
    }
    const data = await pipeline.toBuffer()
    return { data, mimetype: input.mimeType }
  }

  // Photos / other (JPEG, PNG, GIF, WebP, …): WebP original.
  if (rules.photoOriginalFormat === 'webp') {
    const data = await pipeline.webp({ quality: rules.webpQuality }).toBuffer()
    return { data, mimetype: 'image/webp', extHint: 'webp' }
  }

  const data = await pipeline.toBuffer()
  return { data, mimetype: input.mimeType }
}

/** Context key so Core preprocess + Media beforeChange do not double-encode. */
export const STARFORGE_PIPELINE_APPLIED = 'starforgePipelineApplied'
