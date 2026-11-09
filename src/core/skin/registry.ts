import { loadAllSkinPacksSync, toSkin, type LoadedSkinPack } from './pack-io'
import type { Skin, SkinId, SkinRegistry } from './types'

export const STARFORGE_PASTEL_SKIN_ID = 'starforge-pastel' as const
export const STARFORGE_PASTEL_DEFAULT_OUTLINE_ID = 'starforge-pastel-default' as const
export const STARFORGE_PASTEL_OFFLINE_OUTLINE_ID = 'starforge-pastel-offline' as const

const DEFAULT_SKIN_ID: SkinId = STARFORGE_PASTEL_SKIN_ID

type Cache = {
  packs: LoadedSkinPack[]
  byId: SkinRegistry
}

let cache: Cache | null = null

function buildCache(): Cache {
  const packs = loadAllSkinPacksSync()
  const byId: SkinRegistry = {}
  for (const pack of packs) {
    byId[pack.id] = toSkin(pack)
  }
  return { packs, byId }
}

function ensureCache(): Cache {
  if (!cache) cache = buildCache()
  return cache
}

/** Drop in-memory pack list (call after upload/install). */
export function invalidateSkinRegistry(): void {
  cache = null
}

export function listSkinPacksCached(): LoadedSkinPack[] {
  return ensureCache().packs
}

export function getSkinPack(id: SkinId): LoadedSkinPack | null {
  return ensureCache().packs.find((p) => p.id === id) ?? null
}

/**
 * Installed + bundled skins. Always includes the system default (Pastel) even if
 * the YAML pack failed to load, so the toolbar picker never goes empty.
 */
export function listSkins(): Skin[] {
  const byId = { ...ensureCache().byId }
  const defaultId = getDefaultSkinId()
  if (!byId[defaultId]) {
    byId[defaultId] = getDefaultSkin()
  }
  return Object.values(byId).sort((a, b) => {
    if (a.id === defaultId) return -1
    if (b.id === defaultId) return 1
    return a.label.localeCompare(b.label)
  })
}

export function getSkin(id: SkinId): Skin | null {
  return ensureCache().byId[id] ?? null
}

export function isRegisteredSkinId(id: string): boolean {
  return Boolean(id && ensureCache().byId[id])
}

export function getDefaultSkinId(): SkinId {
  return DEFAULT_SKIN_ID
}

export function getDefaultSkin(): Skin {
  return (
    ensureCache().byId[DEFAULT_SKIN_ID] ?? {
      id: DEFAULT_SKIN_ID,
      label: 'Starforge Pastel',
      dataAttr: DEFAULT_SKIN_ID,
      colorScheme: 'light',
      tokens: {
        primary: '#f2a66a',
        primaryStrong: '#a85220',
        primaryInk: '#1c2834',
        secondary: '#8ebad4',
        secondaryStrong: '#2f6f96',
        secondaryInk: '#1c2834',
        ink: '#1c2834',
        muted: '#5a6674',
        paper: '#f5f8fc',
        line: '#d3dce6',
        accent: '#a85220',
        accentInk: '#fff8f2',
        fontDisplay: "'Segoe UI', 'Helvetica Neue', sans-serif",
        fontBody: "'Segoe UI', 'Helvetica Neue', sans-serif",
      },
      preferredDefaultOutlineId: STARFORGE_PASTEL_DEFAULT_OUTLINE_ID,
    }
  )
}
