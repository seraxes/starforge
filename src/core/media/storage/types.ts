/**
 * Media object-storage port (SF-28 / SF-128).
 *
 * Local disk is the default adapter (files under `/media/<category-slug>/`).
 * Spaces/S3 is selected by `STARFORGE_MEDIA_STORAGE=s3` + S3_* env.
 * Both adapters use the same relative key: category slug path + filename.
 * Starforge writes go through this port. The Payload S3 plugin is not on the write path.
 */

export type MediaStorageKind = 'local' | 's3'

export type MediaStorageInfo = {
  kind: MediaStorageKind
  /** Human label for admin / ops. */
  label: string
  /** True when uploads can succeed with the current adapter. */
  ready: boolean
  /** Optional hint when not ready or describing the active backend. */
  detail?: string
}

export type MediaPutInput = {
  /**
   * Relative key (`logos/events/photo.webp`). Segments reject `..`.
   * Derivatives use `logos/events/_derivatives/photo-thumbnail.webp`.
   */
  key: string
  body: Buffer
  mimeType: string
  /**
   * `private` forces a private object ACL on S3 (form attachments).
   * Public library files use the env ACL (`S3_ACL`, default public-read).
   */
  visibility?: 'public' | 'private'
}

export type MediaPutResult = {
  key: string
  /** Site-relative (`/api/media/file/…`) or absolute (public S3/CDN). */
  url: string
}

export type MediaReadResult = {
  body: Buffer
  mimeType: string | null
}

/**
 * Blob port. Document rows live in `sf_media_*`; this only stores bytes.
 */
export interface MediaStorage {
  info(): MediaStorageInfo
  put(input: MediaPutInput): Promise<MediaPutResult>
  delete(key: string): Promise<void>
  /** Null when the object is missing. */
  read(key: string): Promise<MediaReadResult | null>
  /** True when the object is stored. Does not download the body. */
  exists(key: string): Promise<boolean>
}
