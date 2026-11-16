import 'server-only'

import { readFile } from 'node:fs/promises'

import {
  getMediaAsset,
  listAssetPlacements,
  listCategoryRows,
  updateMediaAssetLocations,
  type AssetPlacementRow,
} from './document-store'
import { ensureLegacyCategoryRoots, getCategoryBySlug } from './category-store'
import { ingestImageUpload } from './ingest'
import { isAdminLibraryUploadAllowed, resolveAdminLibraryMime } from './library-files'
import type { MediaSizeName, MediaSizesJson } from './media-record'
import { isPrivateFormMedia } from './privacy'
import { getMediaStorage } from './storage'
import {
  ensureLocalMediaDir,
  isLocalMediaStorage,
  listLocalMediaDropFiles,
  listLocalMediaRootDropFiles,
  mediaDiskPath,
} from './storage/local'
import {
  MEDIA_GENERAL_PREFIX,
  basenameOfStorageKey,
  derivativeStorageKey,
  joinStorageKey,
  storagePrefixFromChain,
} from './storage-key'

const SIZE_NAMES: MediaSizeName[] = ['thumbnail', 'card', 'large']

function prefixForCategory(
  categoryId: string | null,
  byId: Map<string, { slug: string; parentId: string | null }>,
): string {
  const id = (categoryId ?? '').trim()
  if (!id) return storagePrefixFromChain([])
  const slugs: string[] = []
  let walk: string | null = id
  const guard = new Set<string>()
  while (walk && !guard.has(walk)) {
    guard.add(walk)
    const row = byId.get(walk)
    if (!row) break
    slugs.push(row.slug)
    walk = row.parentId
  }
  slugs.reverse()
  return storagePrefixFromChain(slugs)
}

async function copyStoredKey(
  from: string,
  to: string,
  mimeType: string,
  visibility: 'public' | 'private',
): Promise<{ url: string } | null> {
  if (!from || from === to) return null
  const storage = getMediaStorage()
  const current = await storage.read(from)
  if (!current?.body?.length) return null
  const put = await storage.put({
    key: to,
    body: current.body,
    mimeType: mimeType || current.mimeType || 'application/octet-stream',
    visibility,
  })
  return { url: put.url }
}

export type PlaceAssetStatus = 'moved' | 'skipped' | 'missing'

export function storagePrefixForCategoryId(
  categoryId: string | null,
  byId: Map<string, { slug: string; parentId: string | null }>,
): string {
  return prefixForCategory(categoryId, byId)
}

/** Keys a row should use. `needsMove` is false when original and sizes are already filed. */
export function planAssetPlacement(
  row: AssetPlacementRow,
  prefix: string,
): { currentKey: string; targetKey: string; needsMove: boolean } {
  const base = basenameOfStorageKey(row.filename || row.path || '')
  const targetKey = base ? joinStorageKey(prefix, base) : ''
  const currentKey = (row.path || row.filename || '').trim()
  let needsMove = Boolean(currentKey && targetKey && currentKey !== targetKey)
  if (!needsMove) {
    for (const name of SIZE_NAMES) {
      const entry = row.sizes?.[name]
      if (!entry) continue
      const derivBase = basenameOfStorageKey(entry.filename || entry.path || '')
      const derivCurrent = (entry.path || entry.filename || '').trim()
      if (!derivBase || !derivCurrent) continue
      if (derivCurrent !== derivativeStorageKey(prefix, derivBase)) {
        needsMove = true
        break
      }
    }
  }
  return { currentKey, targetKey, needsMove }
}

/**
 * Move one asset under its category prefix. Local disk and S3 share the key.
 * Already-filed rows are skipped. A missing original is not rewritten.
 */
export async function placeMediaAssetInCategory(id: string): Promise<void> {
  const doc = await getMediaAsset(id)
  if (!doc) return
  const categories = await listCategoryRows()
  const byId = new Map(categories.map((cat) => [cat.id, cat]))
  await placeRow(
    {
      id: doc.id,
      alt: doc.alt,
      filename: doc.filename,
      path: doc.path,
      url: doc.url,
      mimeType: doc.mimeType,
      folder: doc.folder,
      private: doc.private,
      categoryId: doc.categoryId,
      sizes: doc.sizes,
    },
    prefixForCategory(doc.categoryId, byId),
  )
}

/**
 * Copy the original and derivatives, update the row, then delete the old keys.
 * Returns `missing` when the original still needs a move and the source object is absent.
 */
export async function placeRow(row: AssetPlacementRow, prefix: string): Promise<PlaceAssetStatus> {
  const base = basenameOfStorageKey(row.filename || row.path || '')
  if (!base) return 'skipped'
  const expected = joinStorageKey(prefix, base)
  const current = (row.path || row.filename || '').trim()
  const visibility = isPrivateFormMedia(row) ? 'private' : 'public'
  let path = current || expected
  let url = (row.url || '').trim()
  let changed = false
  const removeAfterSave: string[] = []

  if (current && current !== expected) {
    const copied = await copyStoredKey(current, expected, row.mimeType || 'application/octet-stream', visibility)
    if (!copied) return 'missing'
    path = expected
    url = copied.url
    changed = true
    removeAfterSave.push(current)
  }

  const sizes: MediaSizesJson = { ...(row.sizes ?? {}) }
  let sizesChanged = false
  let derivativeMissing = false
  for (const name of SIZE_NAMES) {
    const entry = row.sizes?.[name]
    if (!entry) continue
    const derivBase = basenameOfStorageKey(entry.filename || entry.path || '')
    const derivCurrent = (entry.path || entry.filename || '').trim()
    if (!derivBase || !derivCurrent || derivCurrent === derivativeStorageKey(prefix, derivBase)) {
      continue
    }
    const derivExpected = derivativeStorageKey(prefix, derivBase)
    const copied = await copyStoredKey(
      derivCurrent,
      derivExpected,
      entry.mimeType || 'image/webp',
      visibility,
    )
    if (!copied) {
      derivativeMissing = true
      continue
    }
    sizes[name] = {
      ...entry,
      path: derivExpected,
      filename: derivBase,
      url: copied.url,
    }
    sizesChanged = true
    removeAfterSave.push(derivCurrent)
  }

  if (!changed && !sizesChanged) return derivativeMissing ? 'missing' : 'skipped'
  await updateMediaAssetLocations({
    id: row.id,
    path,
    url: url || row.url || '',
    filename: base,
    sizes,
  })
  const storage = getMediaStorage()
  for (const key of removeAfterSave) {
    try {
      await storage.delete(key)
    } catch {
      // The row already points at the new key. A leftover object is not a failed move.
    }
  }
  return 'moved'
}

function rememberKeys(row: AssetPlacementRow, known: Set<string>): void {
  if (row.path) known.add(row.path)
  if (row.filename) known.add(row.filename)
  for (const name of SIZE_NAMES) {
    const entry = row.sizes?.[name]
    if (!entry) continue
    if (entry.path) known.add(entry.path)
    if (entry.filename) known.add(entry.filename)
  }
}

async function importDroppedFile(input: {
  /** Where the bytes sit now (`photo.jpg` at the media root, or `logos/photo.jpg`). */
  diskKey: string
  name: string
  categoryId: string | null
  known: Set<string>
}): Promise<void> {
  if (input.known.has(input.diskKey)) return
  const mime = resolveAdminLibraryMime('', input.name)
  if (!isAdminLibraryUploadAllowed(mime, input.name, { documents: true })) return
  const body = await readFile(mediaDiskPath(input.diskKey))
  const file = new File([new Uint8Array(body)], input.name, { type: mime })
  const alt = input.name.replace(/\.[^.]+$/, '') || input.name
  const saved = await ingestImageUpload({
    file,
    alt,
    categoryRaw: input.categoryId ?? '',
    folderRaw: input.categoryId ? '' : MEDIA_GENERAL_PREFIX,
  })
  input.known.add(input.diskKey)
  input.known.add(input.name)
  if (saved.path) input.known.add(saved.path)
  if (saved.media?.filename) input.known.add(saved.media.filename)
  if (saved.path && saved.path !== input.diskKey) {
    try {
      await getMediaStorage().delete(input.diskKey)
    } catch {
      // The library row exists. The dropped file can be removed on the next pass.
    }
  }
}

let inflight: Promise<void> | null = null

/**
 * Create local category folders and import files dropped into them.
 * Existing blobs are filed by `scripts/file-media-into-categories.mts`, not here.
 */
export function syncMediaCategoryFolders(): Promise<void> {
  if (inflight) return inflight
  inflight = runSync().finally(() => {
    inflight = null
  })
  return inflight
}

async function runSync(): Promise<void> {
  await ensureLegacyCategoryRoots()
  const categories = await listCategoryRows()
  const byId = new Map(categories.map((cat) => [cat.id, cat]))
  const prefixes = new Set<string>([MEDIA_GENERAL_PREFIX])
  for (const cat of categories) {
    prefixes.add(prefixForCategory(cat.id, byId))
  }
  for (const prefix of prefixes) {
    try {
      await ensureLocalMediaDir(prefix)
    } catch {
      // Upload still mkdir's the parent of each object.
    }
  }

  if (!isLocalMediaStorage()) return

  const known = new Set<string>()
  for (const row of await listAssetPlacements()) rememberKeys(row, known)

  const general = await getCategoryBySlug(MEDIA_GENERAL_PREFIX)
  for (const name of await listLocalMediaRootDropFiles()) {
    try {
      await importDroppedFile({
        diskKey: name,
        name,
        categoryId: general?.id ?? null,
        known,
      })
    } catch (err) {
      console.error('[media] could not import', name, err)
    }
  }

  for (const cat of categories) {
    const prefix = prefixForCategory(cat.id, byId)
    for (const name of await listLocalMediaDropFiles(prefix)) {
      try {
        await importDroppedFile({
          diskKey: joinStorageKey(prefix, name),
          name,
          categoryId: cat.id,
          known,
        })
      } catch (err) {
        console.error('[media] could not import', `${prefix}/${name}`, err)
      }
    }
  }
}
