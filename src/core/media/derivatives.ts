/**
 * WebP derivatives for the media document store.
 * sharp only — thumbnail / card / large. Payload imageSizes are not the source of truth.
 */

import sharp from 'sharp'

import type { MediaSizeEntry, MediaSizeName, MediaSizesJson } from './media-record'
import type { MediaPipelineRules } from './pipeline'

export async function readImageSize(
  buffer: Buffer,
  mimeType: string,
): Promise<{ width: number | null; height: number | null }> {
  if (!(mimeType || '').toLowerCase().startsWith('image/')) {
    return { width: null, height: null }
  }
  try {
    const meta = await sharp(buffer).metadata()
    return { width: meta.width ?? null, height: meta.height ?? null }
  } catch {
    return { width: null, height: null }
  }
}

export type RenderedDerivative = {
  name: MediaSizeName
  filename: string
  buffer: Buffer
  width: number
  height: number
  mimeType: string
}

/**
 * Square-cover thumbnail, width-capped card and large. Non-images return nothing.
 * `basename` has no extension (`photo` → `photo-thumbnail.webp`).
 */
export async function renderMediaDerivatives(input: {
  buffer: Buffer
  mimeType: string
  basename: string
  rules: MediaPipelineRules
}): Promise<RenderedDerivative[]> {
  if (!(input.mimeType || '').toLowerCase().startsWith('image/')) return []
  const stem = (input.basename || 'media').replace(/\.+$/, '') || 'media'
  const jobs: Array<{ name: MediaSizeName; edge: number; cover: boolean }> = [
    { name: 'thumbnail', edge: input.rules.sizes.thumbnail, cover: true },
    { name: 'card', edge: input.rules.sizes.card, cover: false },
    { name: 'large', edge: input.rules.sizes.large, cover: false },
  ]
  const out: RenderedDerivative[] = []
  for (const job of jobs) {
    let pipeline = sharp(input.buffer, { failOn: 'none' }).rotate()
    pipeline = job.cover
      ? pipeline.resize(job.edge, job.edge, { fit: 'cover', position: 'centre' })
      : pipeline.resize({ width: job.edge, withoutEnlargement: true })
    const data = await pipeline.webp({ quality: input.rules.webpQuality }).toBuffer()
    const meta = await sharp(data).metadata()
    out.push({
      name: job.name,
      filename: `${stem}-${job.name}.webp`,
      buffer: data,
      width: meta.width ?? job.edge,
      height: meta.height ?? job.edge,
      mimeType: 'image/webp',
    })
  }
  return out
}

export function sizesFromStored(
  entries: Array<{
    name: MediaSizeName
    url: string
    path: string
    filename: string
    width: number
    height: number
    mimeType: string
    filesize: number
  }>,
): MediaSizesJson | null {
  if (!entries.length) return null
  const sizes: MediaSizesJson = {}
  for (const entry of entries) {
    const row: MediaSizeEntry = {
      url: entry.url,
      path: entry.path,
      filename: entry.filename,
      width: entry.width,
      height: entry.height,
      mimeType: entry.mimeType,
      filesize: entry.filesize,
    }
    sizes[entry.name] = row
  }
  return sizes
}
