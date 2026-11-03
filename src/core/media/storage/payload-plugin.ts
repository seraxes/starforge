/**
 * Loaded from `payload.config.ts` (and Payload CLI). No `server-only` —
 * `payload migrate*` / `generate:*` run outside Next and would throw.
 */
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

  const { config, missing } = readS3MediaEnv()
  if (!config) {
    // design-data-deploy §3 / §5: never silently fall back to local disk when s3 is selected.
    throw new Error(
      `STARFORGE_MEDIA_STORAGE=s3 but incomplete env: ${missing.join(', ')}. Unset STARFORGE_MEDIA_STORAGE for local disk.`,
    )
  }

  const publicBase = config.publicBaseUrl

  return s3Storage({
    enabled: true,
    bucket: config.bucket,
    acl: config.acl,
    // Keep Payload access control so folder=forms / private media are not
    // world-readable via /api/media/file/* (Form respondent attachments).
    // Direct CDN URLs would bypass ACL — only wire generateFileURL when ACL is
    // public-read *and* you accept that private form files must not use CDN.
    collections: {
      // Omit disablePayloadAccessControl (default false) so /api/media/file/*
      // honors collection access.read — required for private Form attachments.
      media: {
        ...(publicBase && config.acl === 'public-read'
          ? {
              // Public library assets may use the CDN; private docs still rely on
              // collection access.read (anonymous queries exclude private/forms).
              // Prefer S3_ACL=private in production when Form uploads carry PII.
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
