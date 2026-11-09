/**
 * Zip ↔ skin pack directory (YAML + CSS + outlines).
 */
import { mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { parse as parseYaml } from 'yaml'

import {
  loadSkinFromDir,
  serializeOutlineSeed,
  serializeSkinManifest,
  type LoadedSkinPack,
  type SkinPackWriteInput,
  writeSkinPackDir,
} from './pack-io'
import { SKIN_CSS_NAME, SKIN_MANIFEST_NAME, SKIN_OUTLINES_DIR } from './pack-paths'
import type { SkinOutlineSeed } from './types'

/** Build a zip buffer for a skin pack (optionally with live outline seeds). */
export function zipSkinPack(
  pack: LoadedSkinPack,
  outlines?: SkinOutlineSeed[],
): Uint8Array {
  const seeds = outlines ?? pack.outlineSeeds ?? []
  const root = `${pack.id}/`
  const files: Record<string, Uint8Array> = {}
  files[`${root}${SKIN_MANIFEST_NAME}`] = strToU8(
    serializeSkinManifest({
      id: pack.id,
      label: pack.label,
      colorScheme: pack.colorScheme,
      tokens: pack.tokens,
      preferredDefaultOutlineId: pack.preferredDefaultOutlineId,
      outlines: seeds,
      cssSource: pack.cssSource,
    }),
  )
  for (const seed of seeds) {
    files[`${root}${SKIN_OUTLINES_DIR}/${seed.id}.yaml`] = strToU8(serializeOutlineSeed(seed))
  }
  if (pack.cssSource?.trim()) {
    files[`${root}${SKIN_CSS_NAME}`] = strToU8(pack.cssSource)
  }
  return zipSync(files, { level: 6 })
}

/**
 * Unpack a skin zip, validate via loadSkinFromDir, return write input.
 */
export async function unzipSkinPack(zipBytes: Uint8Array): Promise<SkinPackWriteInput> {
  let entries: Record<string, Uint8Array>
  try {
    entries = unzipSync(zipBytes)
  } catch {
    throw new Error('Could not read skin pack zip.')
  }

  const names = Object.keys(entries)
  if (names.length === 0) throw new Error('Skin pack zip is empty.')

  const manifestEntry =
    names.find((n) => n.replace(/\\/g, '/').endsWith(`/${SKIN_MANIFEST_NAME}`)) ||
    names.find((n) => n.replace(/\\/g, '/') === SKIN_MANIFEST_NAME)
  if (!manifestEntry) {
    throw new Error(`Zip must include ${SKIN_MANIFEST_NAME}.`)
  }

  const normalizedManifest = manifestEntry.replace(/\\/g, '/')
  let rootPrefix = normalizedManifest.includes('/')
    ? normalizedManifest.slice(0, normalizedManifest.lastIndexOf('/') + 1)
    : ''

  // Flat zip (skin.yaml at archive root): nest under id from the manifest.
  if (!rootPrefix) {
    const manifestBytes = entries[manifestEntry]
    if (!manifestBytes) throw new Error(`Zip must include ${SKIN_MANIFEST_NAME}.`)
    const peeked = parseYaml(strFromU8(manifestBytes)) as { id?: unknown }
    const id = typeof peeked?.id === 'string' ? peeked.id.trim() : ''
    if (!id) throw new Error('skin.yaml: missing id')
    rootPrefix = `${id}/`
  }

  const tmp = path.join(
    os.tmpdir(),
    `sf-skin-pack-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  )
  await mkdir(tmp, { recursive: true })

  try {
    for (const [name, data] of Object.entries(entries)) {
      const norm = name.replace(/\\/g, '/')
      if (!norm || norm.endsWith('/')) continue
      if (norm.includes('..')) continue
      const underRoot = norm.startsWith(rootPrefix)
        ? norm
        : `${rootPrefix}${norm}`
      const dest = path.join(tmp, ...underRoot.split('/'))
      await mkdir(path.dirname(dest), { recursive: true })
      await writeFile(dest, Buffer.from(data))
    }

    const packDir = path.join(tmp, rootPrefix.replace(/\/$/, ''))
    const pack = await loadSkinFromDir(packDir, 'installed')
    return {
      id: pack.id,
      label: pack.label,
      colorScheme: pack.colorScheme,
      tokens: pack.tokens,
      preferredDefaultOutlineId: pack.preferredDefaultOutlineId,
      cssSource: pack.cssSource,
      outlines: pack.outlineSeeds ?? [],
    }
  } finally {
    await rm(tmp, { recursive: true, force: true }).catch(() => undefined)
  }
}

/** Write pack files into an absolute directory (tests / export preview). */
export async function materializeSkinPack(
  dir: string,
  input: SkinPackWriteInput,
): Promise<void> {
  await writeSkinPackDir(dir, input)
}

export function skinPackZipFilename(skinId: string): string {
  return `${skinId}-skin-pack.zip`
}
