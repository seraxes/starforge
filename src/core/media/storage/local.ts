import { access, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import {
  MEDIA_DERIVATIVES_DIR,
  assertSafeMediaKey,
  mediaPublicFileUrl,
} from '../storage-key'
import type { MediaPutInput, MediaPutResult, MediaReadResult, MediaStorage, MediaStorageInfo } from './types'

export { assertSafeMediaKey } from '../storage-key'

/** Same directory Payload used as `staticDir` (`<repo>/media`). */
export function mediaDiskRoot(): string {
  return path.resolve(process.cwd(), 'media')
}

export function isLocalMediaStorage(): boolean {
  return process.env.STARFORGE_MEDIA_STORAGE !== 's3'
}

/** Absolute path for a relative key. Stays inside `mediaDiskRoot()`. */
export function mediaDiskPath(key: string): string {
  const safe = assertSafeMediaKey(key)
  const root = mediaDiskRoot()
  const resolved = path.resolve(root, ...safe.split('/'))
  const rel = path.relative(root, resolved)
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('Invalid media storage key.')
  }
  return resolved
}

/** Create the category folder on local disk. No-op when S3 is the active store. */
export async function ensureLocalMediaDir(prefix: string): Promise<void> {
  if (!isLocalMediaStorage()) return
  const dir = mediaDiskPath(prefix)
  await mkdir(dir, { recursive: true })
}

/** Remove a category folder only when it is already empty. */
export async function removeLocalMediaDirIfEmpty(prefix: string): Promise<void> {
  if (!isLocalMediaStorage()) return
  try {
    const dir = mediaDiskPath(prefix)
    await rm(path.join(dir, MEDIA_DERIVATIVES_DIR), { recursive: false }).catch(() => {})
    await rm(dir, { recursive: false })
  } catch {
    // A missing or non-empty folder stays. Category delete already required emptiness.
  }
}

const SKIP_IMPORT = /-(thumbnail|card|large)\.webp$/i

function isDropFileName(name: string): boolean {
  if (!name || name.startsWith('.')) return false
  if (SKIP_IMPORT.test(name)) return false
  return true
}

/** Files sitting directly in a category folder (not subfolders, not derivatives). */
export async function listLocalMediaDropFiles(prefix: string): Promise<string[]> {
  if (!isLocalMediaStorage()) return []
  try {
    const dir = mediaDiskPath(prefix)
    const entries = await readdir(dir, { withFileTypes: true })
    return entries.filter((entry) => entry.isFile() && isDropFileName(entry.name)).map((entry) => entry.name)
  } catch {
    return []
  }
}

/** Loose files in `/media` itself, before they are filed under a category. */
export async function listLocalMediaRootDropFiles(): Promise<string[]> {
  if (!isLocalMediaStorage()) return []
  try {
    const entries = await readdir(mediaDiskRoot(), { withFileTypes: true })
    return entries.filter((entry) => entry.isFile() && isDropFileName(entry.name)).map((entry) => entry.name)
  } catch {
    return []
  }
}

/** Default local-disk adapter. Files land under `/media/<category-slug>/`. */
export const localMediaStorage: MediaStorage = {
  info(): MediaStorageInfo {
    return {
      kind: 'local',
      label: 'Local disk',
      ready: true,
      detail: 'Files under /media/<category>. Set STARFORGE_MEDIA_STORAGE=s3 for Spaces/S3.',
    }
  },

  async put(input: MediaPutInput): Promise<MediaPutResult> {
    const key = assertSafeMediaKey(input.key)
    const dest = mediaDiskPath(key)
    await mkdir(path.dirname(dest), { recursive: true })
    await writeFile(dest, input.body)
    return { key, url: mediaPublicFileUrl(key) }
  },

  async delete(key: string): Promise<void> {
    try {
      await rm(mediaDiskPath(key), { force: true })
    } catch {
      // Missing file is a successful delete.
    }
  },

  async read(key: string): Promise<MediaReadResult | null> {
    try {
      const body = await readFile(mediaDiskPath(key))
      return { body, mimeType: null }
    } catch {
      return null
    }
  },

  async exists(key: string): Promise<boolean> {
    try {
      await access(mediaDiskPath(key))
      return true
    } catch {
      return false
    }
  },
}
