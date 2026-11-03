import 'server-only'

import { s3Storage } from '@payloadcms/storage-s3'
import type { Plugin } from 'payload'

import { isS3MediaStorageSelected, readS3MediaEnv } from './env'

/**
 * Payload `@payloadcms/storage-s3` plugin when MediaStorage kind is s3 and env is complete.
 * Returns null for local (default) or incomplete S3 config — Payload keeps `staticDir`.
 *
 * Sharp resize / WebP imageSizes stay on the Media collection; this only swaps the blob store.
 */
export function createPayloadS3StoragePlugin(): Plugin | null {
  if (!isS3MediaStorageSelected()) return null

  const { config } = readS3MediaEnv()
  if (!config) return null

  const publicBase = config.publicBaseUrl

  return s3Storage({
    enabled: true,
    bucket: config.bucket,
    acl: config.acl,
    // One Payload Media library — public read matches collection access.
    collections: {
      media: {
        // Point file URLs at Spaces/CDN instead of Payload static handlers.
        disablePayloadAccessControl: true,
        ...(publicBase
          ? {
              generateFileURL: ({
                filename,
                prefix,
              }: {
                filename: string
                prefix?: string
              }) => {
                const key = [prefix, filename].filter(Boolean).join('/')
                return `${publicBase}/${key}`
              },
            }
          : {}),
      },
    },
    config: {
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    },
  })
}

/** Plugins array fragment for `buildConfig({ plugins })`. */
export function payloadMediaStoragePlugins(): Plugin[] {
  const plugin = createPayloadS3StoragePlugin()
  return plugin ? [plugin] : []
}
