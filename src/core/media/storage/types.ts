/**
 * Media object-storage port (SF-28 / SF-128).
 *
 * Local disk is the default adapter (Payload `staticDir`).
 * Spaces/S3 is selected by `STARFORGE_MEDIA_STORAGE=s3` + S3_* env —
 * same product Media library (no second media DB).
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

/**
 * Thin port — readiness for Core admin / upload gates.
 * Payload owns file I/O via local `staticDir` or `@payloadcms/storage-s3`.
 */
export interface MediaStorage {
  info(): MediaStorageInfo
}
