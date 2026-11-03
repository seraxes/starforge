/**
 * Shared sharp apply for Core upload + Media `beforeChange` (SF-117 / SF-148).
 * One image engine — do not add Imagick / Jimp / second decoder.
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
}

export type ApplyMediaPipelineResult = {
  data: Buffer
  mimetype: string
  /** Suggested filename extension when format changed (no leading dot). */
  extHint?: string
}

/**
 * Cap longest edge; keep PNG; logo JPEG stays JPEG; photos → WebP.
 * Non-images pass through unchanged (Form PDF/DOC attachments).
 */
export async function applyMediaPipelineRules(
  input: ApplyMediaPipelineInput,
): Promise<ApplyMediaPipelineResult> {
  const rules = input.rules ?? DEFAULT_MEDIA_PIPELINE_RULES
  const mime = (input.mimeType || '').toLowerCase()
  const purpose = normalizeMediaPurpose(input.purpose)

  if (!mime.startsWith('image/')) {
    return { data: input.buffer, mimetype: input.mimeType || 'application/octet-stream' }
  }

  const image = sharp(input.buffer).rotate()
  const meta = await image.metadata()
  const width = meta.width ?? rules.maxWidth
  const height = meta.height ?? rules.maxHeight
  const needsResize = width > rules.maxWidth || height > rules.maxHeight
  let pipeline = image
  if (needsResize) {
    pipeline = pipeline.resize({
      width: rules.maxWidth,
      height: rules.maxHeight,
      fit: 'inside',
      withoutEnlargement: true,
    })
  }

  // PNG always kept (logos / transparency).
  if (mime === 'image/png' && rules.keepPngForLogos) {
    const data = await pipeline.png().toBuffer()
    return { data, mimetype: 'image/png' }
  }

  // Logo JPEG: re-encode JPEG only (no forced WebP).
  if (purpose === 'logo' && (mime === 'image/jpeg' || mime === 'image/jpg')) {
    const data = await pipeline.jpeg({ quality: rules.jpegQuality, mozjpeg: true }).toBuffer()
    return { data, mimetype: 'image/jpeg', extHint: 'jpg' }
  }

  // Logo WebP: keep WebP (resize only) — do not bounce through photo re-encode path twice.
  if (purpose === 'logo' && mime === 'image/webp') {
    const data = await pipeline.webp({ quality: rules.webpQuality }).toBuffer()
    return { data, mimetype: 'image/webp', extHint: 'webp' }
  }

  // Photos / other (JPEG, GIF, WebP, …): WebP original.
  if (rules.photoOriginalFormat === 'webp') {
    const data = await pipeline.webp({ quality: rules.webpQuality }).toBuffer()
    return { data, mimetype: 'image/webp', extHint: 'webp' }
  }

  const data = await pipeline.toBuffer()
  return { data, mimetype: input.mimeType }
}

/** Context key so Core preprocess + Media beforeChange do not double-encode. */
export const STARFORGE_PIPELINE_APPLIED = 'starforgePipelineApplied'
