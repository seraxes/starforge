import { localMediaStorage } from './local'
import { createS3MediaStorage } from './s3'
import type { MediaStorage, MediaStorageInfo, MediaStorageKind } from './types'

export type { MediaStorage, MediaStorageInfo, MediaStorageKind }
export type { MediaPutInput, MediaPutResult, MediaReadResult } from './types'

/**
 * Active media storage backend.
 *
 * - Default / local: files under `/media`, served at `/api/media/file/…`
 * - `STARFORGE_MEDIA_STORAGE=s3`: DigitalOcean Spaces / S3 via `@aws-sdk/client-s3`
 *
 * Document rows are `sf_media_*`. This port is the only blob write path.
 */
export function getMediaStorage(): MediaStorage {
  if (process.env.STARFORGE_MEDIA_STORAGE === 's3') {
    return createS3MediaStorage()
  }
  return localMediaStorage
}

export function getMediaStorageInfo(): MediaStorageInfo {
  return getMediaStorage().info()
}
