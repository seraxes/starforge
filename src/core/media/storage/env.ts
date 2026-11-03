/**
 * Spaces / S3 credentials for MediaStorage (SF-128).
 * Secrets stay in process env / `.env.local` — never Site Settings / DB.
 *
 * No `server-only`: Payload CLI loads this via `payload-plugin.ts`. Do not
 * import from Client Components (type-only imports of MediaStorageInfo are fine).
 */

export type S3ObjectAcl = 'private' | 'public-read'

export type S3MediaEnvConfig = {
  endpoint: string
  bucket: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  /** DO Spaces wants false (virtual-hosted). Path-style optional for MinIO-like. */
  forcePathStyle: boolean
  /**
   * Optional public CDN / virtual-host base (no trailing slash), e.g.
   * `https://my-bucket.nyc3.cdn.digitaloceanspaces.com`.
   * When unset, Payload builds `{endpoint}/{bucket}/{key}`.
   */
  publicBaseUrl?: string
  /**
   * Object ACL on upload. Prefer `private` when Form respondent attachments
   * may land in the same bucket (Payload access control + admin route serve them).
   * `public-read` keeps library CDN URLs working but object URLs are guessable.
   */
  acl: S3ObjectAcl
}

const REQUIRED_KEYS = [
  'S3_ENDPOINT',
  'S3_BUCKET',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
] as const

function trimEnv(key: string): string {
  return (process.env[key] ?? '').trim()
}

function parseForcePathStyle(): boolean {
  const raw = trimEnv('S3_FORCE_PATH_STYLE').toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes'
}

function parseAcl(): S3ObjectAcl {
  const raw = trimEnv('S3_ACL').toLowerCase()
  if (raw === 'private') return 'private'
  return 'public-read'
}

/** True when ops selected the S3/Spaces backend. */
export function isS3MediaStorageSelected(): boolean {
  return trimEnv('STARFORGE_MEDIA_STORAGE').toLowerCase() === 's3'
}

/**
 * Read S3/Spaces env. Returns `missing` key names when incomplete —
 * callers must not invent defaults for secrets or bucket.
 */
export function readS3MediaEnv(): { config: S3MediaEnvConfig | null; missing: string[] } {
  const missing: string[] = []
  for (const key of REQUIRED_KEYS) {
    if (!trimEnv(key)) missing.push(key)
  }

  const endpoint = trimEnv('S3_ENDPOINT').replace(/\/$/, '')
  const bucket = trimEnv('S3_BUCKET')
  const accessKeyId = trimEnv('S3_ACCESS_KEY_ID')
  const secretAccessKey = trimEnv('S3_SECRET_ACCESS_KEY')
  const region = trimEnv('S3_REGION') || 'us-east-1'
  const publicBase = trimEnv('S3_PUBLIC_BASE_URL').replace(/\/$/, '')

  if (missing.length) {
    return { config: null, missing }
  }

  if (endpoint && !/^https?:\/\//i.test(endpoint)) {
    missing.push('S3_ENDPOINT (must be http(s) URL, e.g. https://nyc3.digitaloceanspaces.com)')
    return { config: null, missing }
  }

  return {
    config: {
      endpoint,
      bucket,
      region,
      accessKeyId,
      secretAccessKey,
      forcePathStyle: parseForcePathStyle(),
      publicBaseUrl: publicBase || undefined,
      acl: parseAcl(),
    },
    missing: [],
  }
}
