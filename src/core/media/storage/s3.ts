import type { MediaStorage, MediaStorageInfo } from './types'

/**
 * Spaces/S3 adapter stub — selected when `STARFORGE_MEDIA_STORAGE=s3`.
 * Not implemented until DigitalOcean hosting prep (see modularity plan).
 */
export function createS3MediaStorage(): MediaStorage {
  return {
    info(): MediaStorageInfo {
      return {
        kind: 's3',
        label: 'S3 / Spaces',
        ready: false,
        detail:
          'S3/Spaces adapter not wired yet. Unset STARFORGE_MEDIA_STORAGE (or set local) for disk uploads.',
      }
    },
  }
}
