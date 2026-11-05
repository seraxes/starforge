import { localMediaStorage } from './local'
import { createS3MediaStorage } from './s3'
import type { MediaStorage, MediaStorageInfo, MediaStorageKind } from './types'

export type { MediaStorage, MediaStorageInfo, MediaStorageKind }

/**
 * Active media storage backend.
 *
 * - Default / local: Payload disk (`staticDir` under `/media`)
 * - `STARFORGE_MEDIA_STORAGE=s3`: DigitalOcean Spaces / S3 (`S3_*` env + Payload plugin)
 *
 * Payload plugin wiring: import `payloadMediaStoragePlugins` from
 * `@/core/media/storage/payload-plugin` in `payload.config.ts`. That file
 * lazy-requires `@payloadcms/storage-s3` only when `STARFORGE_MEDIA_STORAGE=s3`
 * so local disk / migrate / generate / Turbopack proxy traces do not need it.
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
