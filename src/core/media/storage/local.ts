import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { MediaPutInput, MediaPutResult, MediaReadResult, MediaStorage, MediaStorageInfo } from './types'

/** Same directory Payload used as `staticDir` (`<repo>/media`). */
export function mediaDiskRoot(): string {
  return path.resolve(process.cwd(), 'media')
}

/** Basename only — rejects path traversal. */
export function assertSafeMediaKey(key: string): string {
  const raw = String(key ?? '').trim()
  if (!raw || raw.includes('/') || raw.includes('\\') || raw.includes('..')) {
    throw new Error('Invalid media storage key.')
  }
  if (raw === '.' || raw === '..') throw new Error('Invalid media storage key.')
  return raw
}

function fileUrl(key: string): string {
  return `/api/media/file/${encodeURIComponent(key)}`
}

/** Default local-disk adapter. Files land under `/media`. */
export const localMediaStorage: MediaStorage = {
  info(): MediaStorageInfo {
    return {
      kind: 'local',
      label: 'Local disk',
      ready: true,
      detail: 'Files under /media. Set STARFORGE_MEDIA_STORAGE=s3 for Spaces/S3.',
    }
  },

  async put(input: MediaPutInput): Promise<MediaPutResult> {
    const key = assertSafeMediaKey(input.key)
    const root = mediaDiskRoot()
    await mkdir(root, { recursive: true })
    await writeFile(path.join(root, key), input.body)
    return { key, url: fileUrl(key) }
  },

  async delete(key: string): Promise<void> {
    const safe = assertSafeMediaKey(key)
    try {
      await rm(path.join(mediaDiskRoot(), safe), { force: true })
    } catch {
      // Missing file is a successful delete.
    }
  },

  async read(key: string): Promise<MediaReadResult | null> {
    try {
      const safe = assertSafeMediaKey(key)
      const body = await readFile(path.join(mediaDiskRoot(), safe))
      return { body, mimeType: null }
    } catch {
      return null
    }
  },
}
