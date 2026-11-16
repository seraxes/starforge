import 'server-only'

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'

import { encodeStorageKeyPath, mediaPublicFileUrl } from '../storage-key'
import { isS3MediaStorageSelected, readS3MediaEnv, type S3MediaEnvConfig } from './env'
import { assertSafeMediaKey } from './local'
import type { MediaPutInput, MediaPutResult, MediaReadResult, MediaStorage, MediaStorageInfo } from './types'

function objectUrl(config: S3MediaEnvConfig, key: string): string {
  const encoded = encodeStorageKeyPath(key)
  if (config.publicBaseUrl) return `${config.publicBaseUrl.replace(/\/$/, '')}/${encoded}`
  return `${config.endpoint.replace(/\/$/, '')}/${config.bucket}/${encoded}`
}

function appFileUrl(key: string): string {
  return mediaPublicFileUrl(key)
}

/**
 * Spaces/S3 MediaStorage adapter — selected when `STARFORGE_MEDIA_STORAGE=s3`.
 * Writes use `@aws-sdk/client-s3` directly. The Payload storage plugin is not called.
 */
export function createS3MediaStorage(): MediaStorage {
  let client: S3Client | null = null

  function requireConfig(): S3MediaEnvConfig {
    const { config, missing } = readS3MediaEnv()
    if (!config) {
      throw new Error(
        `S3/Spaces needs env: ${missing.join(', ')}. Set them in .env or unset STARFORGE_MEDIA_STORAGE (local disk).`,
      )
    }
    return config
  }

  function s3(): { client: S3Client; config: S3MediaEnvConfig } {
    const config = requireConfig()
    if (!client) {
      client = new S3Client({
        endpoint: config.endpoint,
        region: config.region,
        forcePathStyle: config.forcePathStyle,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      })
    }
    return { client, config }
  }

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

    async put(input: MediaPutInput): Promise<MediaPutResult> {
      const key = assertSafeMediaKey(input.key)
      const { client: s3client, config } = s3()
      const acl = input.visibility === 'private' ? 'private' : config.acl
      await s3client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: input.body,
          ContentType: input.mimeType || 'application/octet-stream',
          ACL: acl,
        }),
      )
      // Private objects must not publish a guessable CDN URL.
      const url = acl === 'private' ? appFileUrl(key) : objectUrl(config, key)
      return { key, url }
    },

    async delete(key: string): Promise<void> {
      const safe = assertSafeMediaKey(key)
      const { client: s3client, config } = s3()
      await s3client.send(
        new DeleteObjectCommand({
          Bucket: config.bucket,
          Key: safe,
        }),
      )
    },

    async exists(key: string): Promise<boolean> {
      try {
        const safe = assertSafeMediaKey(key)
        const { client: s3client, config } = s3()
        await s3client.send(
          new HeadObjectCommand({
            Bucket: config.bucket,
            Key: safe,
          }),
        )
        return true
      } catch {
        return false
      }
    },

    async read(key: string): Promise<MediaReadResult | null> {
      try {
        const safe = assertSafeMediaKey(key)
        const { client: s3client, config } = s3()
        const out = await s3client.send(
          new GetObjectCommand({
            Bucket: config.bucket,
            Key: safe,
          }),
        )
        const bytes = await out.Body?.transformToByteArray()
        if (!bytes) return null
        return {
          body: Buffer.from(bytes),
          mimeType: out.ContentType ?? null,
        }
      } catch {
        return null
      }
    },
  }
}
