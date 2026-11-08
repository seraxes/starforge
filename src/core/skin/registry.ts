import {
  STARFORGE_PASTEL_SKIN_ID,
  starforgePastelSkin,
} from './skins/starforge-pastel'
import type { Skin, SkinId, SkinRegistry } from './types'

/**
 * Installed public skins. Add another package entry when shipping a second look;
 * wire CSS via `active.css` imports (static Next CSS).
 */
const registry: SkinRegistry = {
  [STARFORGE_PASTEL_SKIN_ID]: starforgePastelSkin,
}

const DEFAULT_SKIN_ID: SkinId = STARFORGE_PASTEL_SKIN_ID

export function listSkins(): Skin[] {
  return Object.values(registry)
}

export function getSkin(id: SkinId): Skin | null {
  return registry[id] ?? null
}

export function isRegisteredSkinId(id: string): boolean {
  return Boolean(id && registry[id])
}

export function getDefaultSkinId(): SkinId {
  return DEFAULT_SKIN_ID
}

export function getDefaultSkin(): Skin {
  return registry[DEFAULT_SKIN_ID] ?? starforgePastelSkin
}
