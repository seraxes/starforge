/**
 * Document shape for a product:media asset (phase 2b).
 * Client-safe: no database, no Payload.
 */

export type MediaSizeName = 'thumbnail' | 'card' | 'large'

export type MediaSizeEntry = {
  url?: string | null
  path?: string | null
  filename?: string | null
  width?: number | null
  height?: number | null
  mimeType?: string | null
  filesize?: number | null
}

export type MediaSizesJson = Partial<Record<MediaSizeName, MediaSizeEntry>>

/** One row in `sf_media_assets`, with category label and tag labels filled in. */
export type MediaDoc = {
  id: string
  alt: string
  mimeType: string | null
  filename: string | null
  filesize: number | null
  width: number | null
  height: number | null
  folder: string | null
  purpose: string | null
  private: boolean
  categoryId: string | null
  categoryLabel: string | null
  url: string | null
  path: string | null
  sizes: MediaSizesJson | null
  tagIds: string[]
  tagLabels: string[]
}
