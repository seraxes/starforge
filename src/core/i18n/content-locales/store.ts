import 'server-only'

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import {
  contentLocaleFileRefForKey,
  isValidContentLocaleKey,
  sanitizeContentLocaleId,
} from '../content-locale-keys'
import {
  getContentLocaleDir,
  getContentLocaleFilePath,
  getContentLocalesRoot,
  type ContentLocaleScope,
} from './paths'

export type ContentLocaleCatalog = Record<string, string>

type CacheEntry = {
  catalog: ContentLocaleCatalog
  loadedAt: number
}

const catalogCache = new Map<string, CacheEntry>()

function isPlainStringMap(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function normalizeContentLocaleFileMap(raw: unknown): ContentLocaleCatalog {
  if (!isPlainStringMap(raw)) return {}
  const out: ContentLocaleCatalog = {}
  for (const [key, value] of Object.entries(raw)) {
    if (key.startsWith('_')) continue
    if (!isValidContentLocaleKey(key)) continue
    if (typeof value !== 'string') continue
    const text = value.trim()
    if (text) out[key] = text
  }
  return out
}

export function invalidateContentLocaleCatalog(locale?: string) {
  if (!locale) {
    catalogCache.clear()
    return
  }
  catalogCache.delete(sanitizeContentLocaleId(locale) || locale)
}

async function readJsonFile(filePath: string): Promise<unknown> {
  try {
    const text = await readFile(filePath, 'utf8')
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

async function listJsonFiles(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => path.join(dir, entry.name))
  } catch {
    return []
  }
}

/** Merge all layout/nav JSON files for one language into a flat key → string catalog. */
export async function loadContentLocaleCatalog(locale: string): Promise<ContentLocaleCatalog> {
  const code = sanitizeContentLocaleId(locale) || 'en'
  const cached = catalogCache.get(code)
  if (cached) return cached.catalog

  const root = getContentLocaleDir(code)
  const files = [
    ...(await listJsonFiles(path.join(root, 'layouts'))),
    ...(await listJsonFiles(path.join(root, 'nav'))),
  ]
  const catalog: ContentLocaleCatalog = {}
  for (const filePath of files) {
    const parsed = await readJsonFile(filePath)
    Object.assign(catalog, normalizeContentLocaleFileMap(parsed))
  }
  catalogCache.set(code, { catalog, loadedAt: Date.now() })
  return catalog
}

export async function readContentLocaleFile(
  locale: string,
  scope: ContentLocaleScope,
  ownerId: string,
): Promise<ContentLocaleCatalog> {
  const filePath = getContentLocaleFilePath(locale, scope, ownerId)
  return normalizeContentLocaleFileMap(await readJsonFile(filePath))
}

export async function writeContentLocaleFile(
  locale: string,
  scope: ContentLocaleScope,
  ownerId: string,
  map: ContentLocaleCatalog,
): Promise<void> {
  const normalized = normalizeContentLocaleFileMap(map)
  const filePath = getContentLocaleFilePath(locale, scope, ownerId)
  await mkdir(path.dirname(filePath), { recursive: true })
  const ordered = Object.keys(normalized)
    .sort((a, b) => a.localeCompare(b))
    .reduce<ContentLocaleCatalog>((acc, key) => {
      acc[key] = normalized[key]!
      return acc
    }, {})
  await writeFile(filePath, `${JSON.stringify(ordered, null, 2)}\n`, 'utf8')
  invalidateContentLocaleCatalog(locale)
}

/** Upsert one key into its owner file (creates the file when missing). */
export async function upsertContentLocaleValue(
  locale: string,
  key: string,
  value: string,
): Promise<{ error?: string }> {
  const ref = contentLocaleFileRefForKey(key)
  if (!ref) return { error: `Invalid content locale key “${key}”.` }
  const current = await readContentLocaleFile(locale, ref.scope, ref.ownerId)
  const trimmed = value.trim()
  if (trimmed) current[key] = trimmed
  else delete current[key]
  await writeContentLocaleFile(locale, ref.scope, ref.ownerId, current)
  return {}
}

/** Write many key → value pairs for one locale (grouped by owner file). */
export async function upsertContentLocaleValues(
  locale: string,
  entries: Record<string, string>,
): Promise<{ error?: string }> {
  const byFile = new Map<string, { scope: ContentLocaleScope; ownerId: string; map: ContentLocaleCatalog }>()
  for (const [key, value] of Object.entries(entries)) {
    const ref = contentLocaleFileRefForKey(key)
    if (!ref) return { error: `Invalid content locale key “${key}”.` }
    const fileKey = `${ref.scope}:${ref.ownerId}`
    let bucket = byFile.get(fileKey)
    if (!bucket) {
      const existing = await readContentLocaleFile(locale, ref.scope, ref.ownerId)
      bucket = { scope: ref.scope, ownerId: ref.ownerId, map: { ...existing } }
      byFile.set(fileKey, bucket)
    }
    const trimmed = value.trim()
    if (trimmed) bucket.map[key] = trimmed
    else delete bucket.map[key]
  }
  for (const bucket of byFile.values()) {
    await writeContentLocaleFile(locale, bucket.scope, bucket.ownerId, bucket.map)
  }
  return {}
}

export async function listContentLocaleCodesOnDisk(): Promise<string[]> {
  try {
    const entries = await readdir(getContentLocalesRoot(), { withFileTypes: true })
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b))
  } catch {
    return []
  }
}

export async function listContentLocaleFiles(
  locale: string,
): Promise<{ scope: ContentLocaleScope; ownerId: string; relativePath: string }[]> {
  const code = sanitizeContentLocaleId(locale) || 'en'
  const out: { scope: ContentLocaleScope; ownerId: string; relativePath: string }[] = []
  for (const scope of ['layouts', 'nav'] as const) {
    const files = await listJsonFiles(path.join(getContentLocaleDir(code), scope))
    for (const filePath of files) {
      const ownerId = path.basename(filePath, '.json')
      out.push({
        scope,
        ownerId,
        relativePath: `${scope}/${ownerId}.json`,
      })
    }
  }
  return out
}

export function pickFromContentCatalog(
  catalog: ContentLocaleCatalog | undefined,
  key: string,
): string {
  const value = catalog?.[key]
  return typeof value === 'string' ? value.trim() : ''
}
