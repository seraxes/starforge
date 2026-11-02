import { localMediaStorage } from './local'
import { createS3MediaStorage } from './s3'
import type { MediaStorage, MediaStorageInfo, MediaStorageKind } from './types'

export type { MediaStorage, MediaStorageInfo, MediaStorageKind }

/**
 * Active media storage backend.
 *
 * - Default / local: Payload disk (`staticDir`)
 * - `STARFORGE_MEDIA_STORAGE=s3`: Spaces/S3 stub until DO
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
