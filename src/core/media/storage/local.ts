import type { MediaStorage, MediaStorageInfo } from './types'

/** Default local-disk adapter — Payload writes under `/media` (gitignored). */
export const localMediaStorage: MediaStorage = {
  info(): MediaStorageInfo {
    return {
      kind: 'local',
      label: 'Local disk',
      ready: true,
      detail: 'Files under /media via Payload staticDir. Set STARFORGE_MEDIA_STORAGE=s3 for Spaces/S3.',
    }
  },
}
