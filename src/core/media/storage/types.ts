/**
 * Media object-storage port (SF-28).
 *
 * Local disk is the default adapter (Payload `staticDir`).
 * Spaces/S3 is selected by env later — same product Media library.
 */

export type MediaStorageKind = 'local' | 's3'

export type MediaStorageInfo = {
  kind: MediaStorageKind
  /** Human label for admin / ops. */
  label: string
  /** True when uploads can succeed with the current adapter. */
  ready: boolean
  /** Optional hint when not ready (e.g. S3 stub). */
  detail?: string
}

/**
 * Thin port — Payload owns file I/O today; this documents the swap point
 * and exposes readiness for admin. Full adapter wiring lands with DO Spaces.
 */
export interface MediaStorage {
  info(): MediaStorageInfo
}
