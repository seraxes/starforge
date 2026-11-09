/**
 * Skin pack YAML + files — load / validate / write directories.
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { parse, stringify } from 'yaml'

import type { LayoutDocument } from '@/core/modules/types'

import {
  SKIN_CSS_NAME,
  SKIN_MANIFEST_NAME,
  SKIN_OUTLINES_DIR,
  getBundledSkinsRoot,
  getInstalledSkinDir,
  getInstalledSkinsRoot,
} from './pack-paths'
import type { Skin, SkinColorScheme, SkinId, SkinOutlineSeed, SkinTokens } from './types'

export type SkinPackSource = 'bundled' | 'installed'

export type LoadedSkinPack = Skin & {
  source: SkinPackSource
  packDir: string
  cssSource?: string
}

const TOKEN_KEYS: (keyof SkinTokens)[] = [
  'primary',
  'primaryStrong',
  'primaryInk',
  'secondary',
  'secondaryStrong',
  'secondaryInk',
  'ink',
  'muted',
  'paper',
  'line',
  'accent',
  'accentInk',
  'fontDisplay',
  'fontBody',
]

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function requireString(row: Record<string, unknown>, key: string): string {
  const v = row[key]
  if (typeof v !== 'string' || !v.trim()) {
    throw new Error(`skin.yaml: missing or empty "${key}"`)
  }
  return v.trim()
}

function parseTokens(raw: unknown): SkinTokens {
  const row = asRecord(raw)
  if (!row) throw new Error('skin.yaml: tokens object required')
  const tokens = {} as SkinTokens
  for (const key of TOKEN_KEYS) {
    const v = row[key]
    if (typeof v !== 'string' || !v.trim()) {
      throw new Error(`skin.yaml: tokens.${key} must be a non-empty string`)
    }
    tokens[key] = v.trim()
  }
  return tokens
}

function parseColorScheme(raw: unknown): SkinColorScheme {
  if (raw === 'dark') return 'dark'
  if (raw === 'light' || raw == null || raw === '') return 'light'
  throw new Error('skin.yaml: colorScheme must be "light" or "dark"')
}

function parseLayoutDocument(raw: unknown, outlineId: string): LayoutDocument {
  const row = asRecord(raw)
  if (!row) throw new Error(`outline ${outlineId}: document object required`)
  if (row.version !== 3) {
    throw new Error(`outline ${outlineId}: document.version must be 3`)
  }
  if (!Array.isArray(row.sections)) {
    throw new Error(`outline ${outlineId}: document.sections must be an array`)
  }
  return raw as LayoutDocument
}

function parseOutlineYaml(raw: unknown, fallbackId: string): SkinOutlineSeed {
  const row = asRecord(raw)
  if (!row) throw new Error(`outline ${fallbackId}: invalid YAML root`)
  const id =
    typeof row.id === 'string' && row.id.trim() ? row.id.trim() : fallbackId
  const label =
    typeof row.label === 'string' && row.label.trim() ? row.label.trim() : id
  const document = parseLayoutDocument(row.document, id)
  const seed: SkinOutlineSeed = { id, label, document }
  if (row.defaultForSite === true) seed.defaultForSite = true
  if (row.forceUpdate === true) seed.forceUpdate = true
  return seed
}

function parseManifest(
  raw: unknown,
  dirName: string,
): {
  id: SkinId
  label: string
  colorScheme: SkinColorScheme
  tokens: SkinTokens
  preferredDefaultOutlineId?: string
} {
  const row = asRecord(raw)
  if (!row) throw new Error('skin.yaml: invalid YAML root')
  const id = requireString(row, 'id')
  if (id !== dirName) {
    throw new Error(`skin.yaml id "${id}" must match folder name "${dirName}"`)
  }
  const label = requireString(row, 'label')
  const colorScheme = parseColorScheme(row.colorScheme)
  const tokens = parseTokens(row.tokens)
  const preferred =
    typeof row.preferredDefaultOutlineId === 'string' &&
    row.preferredDefaultOutlineId.trim()
      ? row.preferredDefaultOutlineId.trim()
      : undefined
  return { id, label, colorScheme, tokens, preferredDefaultOutlineId: preferred }
}

function loadSkinFromDirSync(packDir: string, source: SkinPackSource): LoadedSkinPack {
  const dirName = path.basename(packDir)
  const manifestPath = path.join(packDir, SKIN_MANIFEST_NAME)
  if (!existsSync(manifestPath)) {
    throw new Error(`Missing ${SKIN_MANIFEST_NAME} in ${packDir}`)
  }
  const manifestRaw = parse(readFileSync(manifestPath, 'utf8'))
  const meta = parseManifest(manifestRaw, dirName)

  const outlineSeeds: SkinOutlineSeed[] = []
  const outlinesDir = path.join(packDir, SKIN_OUTLINES_DIR)
  if (existsSync(outlinesDir)) {
    const entries = readdirSync(outlinesDir)
    for (const name of entries.sort()) {
      if (!name.endsWith('.yaml') && !name.endsWith('.yml')) continue
      const fallbackId = name.replace(/\.ya?ml$/i, '')
      const yamlRaw = parse(readFileSync(path.join(outlinesDir, name), 'utf8'))
      outlineSeeds.push(parseOutlineYaml(yamlRaw, fallbackId))
    }
  }

  let cssSource: string | undefined
  const cssPath = path.join(packDir, SKIN_CSS_NAME)
  if (existsSync(cssPath)) {
    cssSource = readFileSync(cssPath, 'utf8')
  }

  const preferredDefaultOutlineId =
    meta.preferredDefaultOutlineId ||
    outlineSeeds.find((s) => s.defaultForSite)?.id ||
    outlineSeeds[0]?.id

  return {
    id: meta.id,
    label: meta.label,
    dataAttr: meta.id,
    colorScheme: meta.colorScheme,
    tokens: meta.tokens,
    preferredDefaultOutlineId,
    outlineSeeds,
    cssSource,
    source,
    packDir,
  }
}

export async function loadSkinFromDir(
  packDir: string,
  source: SkinPackSource,
): Promise<LoadedSkinPack> {
  return loadSkinFromDirSync(packDir, source)
}

function listPackDirsSync(root: string): string[] {
  if (!existsSync(root)) return []
  const entries = readdirSync(root, { withFileTypes: true })
  const dirs: string[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (entry.name.startsWith('.')) continue
    const packDir = path.join(root, entry.name)
    if (existsSync(path.join(packDir, SKIN_MANIFEST_NAME))) {
      dirs.push(packDir)
    }
  }
  return dirs.sort()
}

/** Installed packs override bundled packs with the same id. */
export function loadAllSkinPacksSync(): LoadedSkinPack[] {
  const byId = new Map<string, LoadedSkinPack>()
  for (const dir of listPackDirsSync(getBundledSkinsRoot())) {
    const pack = loadSkinFromDirSync(dir, 'bundled')
    byId.set(pack.id, pack)
  }
  for (const dir of listPackDirsSync(getInstalledSkinsRoot())) {
    const pack = loadSkinFromDirSync(dir, 'installed')
    byId.set(pack.id, pack)
  }
  return [...byId.values()].sort((a, b) => a.label.localeCompare(b.label))
}

export async function loadAllSkinPacks(): Promise<LoadedSkinPack[]> {
  return loadAllSkinPacksSync()
}

export type SkinPackWriteInput = {
  id: string
  label: string
  colorScheme: SkinColorScheme
  tokens: SkinTokens
  preferredDefaultOutlineId?: string
  cssSource?: string
  outlines: SkinOutlineSeed[]
}

export function serializeSkinManifest(input: SkinPackWriteInput): string {
  const doc: Record<string, unknown> = {
    id: input.id,
    label: input.label,
    colorScheme: input.colorScheme,
    tokens: input.tokens,
  }
  if (input.preferredDefaultOutlineId) {
    doc.preferredDefaultOutlineId = input.preferredDefaultOutlineId
  }
  return stringify(doc, { lineWidth: 100 })
}

export function serializeOutlineSeed(seed: SkinOutlineSeed): string {
  const doc: Record<string, unknown> = {
    id: seed.id,
    label: seed.label,
    document: seed.document,
  }
  if (seed.defaultForSite) doc.defaultForSite = true
  if (seed.forceUpdate) doc.forceUpdate = true
  return stringify(doc, { lineWidth: 100 })
}

export async function writeSkinPackDir(
  packDir: string,
  input: SkinPackWriteInput,
): Promise<void> {
  await mkdir(packDir, { recursive: true })
  await writeFile(path.join(packDir, SKIN_MANIFEST_NAME), serializeSkinManifest(input), 'utf8')

  const outlinesDir = path.join(packDir, SKIN_OUTLINES_DIR)
  await mkdir(outlinesDir, { recursive: true })
  const existing = await readdir(outlinesDir).catch(() => [] as string[])
  for (const name of existing) {
    if (name.endsWith('.yaml') || name.endsWith('.yml') || name.endsWith('.json')) {
      await rm(path.join(outlinesDir, name), { force: true })
    }
  }
  for (const seed of input.outlines) {
    await writeFile(
      path.join(outlinesDir, `${seed.id}.yaml`),
      serializeOutlineSeed(seed),
      'utf8',
    )
  }

  const cssPath = path.join(packDir, SKIN_CSS_NAME)
  if (input.cssSource != null && input.cssSource.trim()) {
    await writeFile(cssPath, input.cssSource, 'utf8')
  } else if (existsSync(cssPath)) {
    await rm(cssPath, { force: true })
  }
}

export async function installSkinPackToData(
  input: SkinPackWriteInput,
): Promise<LoadedSkinPack> {
  const id = input.id.trim()
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    throw new Error('Skin id must be lowercase kebab-case (a-z, 0-9, hyphens).')
  }
  const packDir = getInstalledSkinDir(id)
  await mkdir(getInstalledSkinsRoot(), { recursive: true })
  await writeSkinPackDir(packDir, { ...input, id })
  return loadSkinFromDirSync(packDir, 'installed')
}

export function toSkin(pack: LoadedSkinPack): Skin {
  return {
    id: pack.id,
    label: pack.label,
    dataAttr: pack.dataAttr,
    colorScheme: pack.colorScheme,
    tokens: pack.tokens,
    preferredDefaultOutlineId: pack.preferredDefaultOutlineId,
    outlineSeeds: pack.outlineSeeds,
    cssSource: pack.cssSource,
    source: pack.source,
    packDir: pack.packDir,
  }
}

/** Sync write helpers for tests. */
export function writeSkinPackDirSync(packDir: string, input: SkinPackWriteInput): void {
  mkdirSync(packDir, { recursive: true })
  writeFileSync(path.join(packDir, SKIN_MANIFEST_NAME), serializeSkinManifest(input), 'utf8')
  const outlinesDir = path.join(packDir, SKIN_OUTLINES_DIR)
  mkdirSync(outlinesDir, { recursive: true })
  for (const seed of input.outlines) {
    writeFileSync(path.join(outlinesDir, `${seed.id}.yaml`), serializeOutlineSeed(seed), 'utf8')
  }
  if (input.cssSource?.trim()) {
    writeFileSync(path.join(packDir, SKIN_CSS_NAME), input.cssSource, 'utf8')
  }
}
