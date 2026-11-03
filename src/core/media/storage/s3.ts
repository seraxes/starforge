import 'server-only'

import { isS3MediaStorageSelected, readS3MediaEnv } from './env'
import type { MediaStorage, MediaStorageInfo } from './types'

/**
 * Spaces/S3 MediaStorage adapter — selected when `STARFORGE_MEDIA_STORAGE=s3`.
 * Payload upload I/O is wired via `@payloadcms/storage-s3` (see `payload-plugin.ts`).
 * This port reports readiness for Core admin / upload gates.
 */
export function createS3MediaStorage(): MediaStorage {
  return {
    info(): MediaStorageInfo {
      if (!isS3MediaStorageSelected()) {
        return {
          kind: 's3',
          label: 'S3 / Spaces',
          ready: false,
          detail: 'Set STARFORGE_MEDIA_STORAGE=s3 to select this adapter.',
        }
      }

      const { config, missing } = readS3MediaEnv()
      if (!config) {
        return {
          kind: 's3',
          label: 'S3 / Spaces',
          ready: false,
          detail: `S3/Spaces needs env: ${missing.join(', ')}. Set them in .env or Chrome → Environment, or unset STARFORGE_MEDIA_STORAGE (local disk).`,
        }
      }

      const where = config.publicBaseUrl
        ? config.publicBaseUrl
        : `${config.endpoint}/${config.bucket}`

      return {
        kind: 's3',
        label: 'S3 / Spaces',
        ready: true,
        detail: `Bucket ${config.bucket} (${config.region}) → ${where}. ACL ${config.acl}.`,
      }
    },
  }
}
