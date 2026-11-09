/**
 * Skin pack directories — bundled (repo) + installed (writable data/skins).
 */
import path from 'node:path'

export const SKIN_MANIFEST_NAME = 'skin.yaml'
export const SKIN_CSS_NAME = 'skin.css'
export const SKIN_OUTLINES_DIR = 'outlines'

export function projectRoot(): string {
  return process.cwd()
}

/** Built-in packs shipped with Core (`src/core/skin/skins/<id>/`). */
export function getBundledSkinsRoot(): string {
  return path.join(projectRoot(), 'src', 'core', 'skin', 'skins')
}

/** Uploaded / site-installed packs (`data/skins/<id>/`). */
export function getInstalledSkinsRoot(): string {
  return path.join(projectRoot(), 'data', 'skins')
}

export function getBundledSkinDir(skinId: string): string {
  return path.join(getBundledSkinsRoot(), skinId)
}

export function getInstalledSkinDir(skinId: string): string {
  return path.join(getInstalledSkinsRoot(), skinId)
}
