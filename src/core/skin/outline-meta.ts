import type { Skin, SkinOutlineSeed } from './types'

/** Whether an outline id is owned by a skin package (id prefix convention). */
export function isOutlineOwnedBySkin(skinId: string, outlineId: string): boolean {
  const id = outlineId.trim()
  const skin = skinId.trim()
  if (!id || !skin) return false
  return id === skin || id.startsWith(`${skin}-`)
}

/**
 * Whether a layout outline row belongs to a skin (`skin_id` or id-prefix fallback).
 * Core bootstrap `default` (no skin_id, no prefix) is never attributed to a pack.
 */
export function outlineBelongsToSkin(
  skinId: string,
  outline: { id: string; skinId?: string | null },
): boolean {
  const skin = skinId.trim()
  if (!skin || !outline?.id) return false
  const owned = typeof outline.skinId === 'string' ? outline.skinId.trim() : ''
  if (owned) return owned === skin
  return isOutlineOwnedBySkin(skin, outline.id)
}

/** Outlines for the toolbar-selected skin (Layouts chrome / Outlines admin). */
export function filterOutlinesForSkin<T extends { id: string; skinId?: string | null }>(
  outlines: readonly T[],
  skinId: string,
): T[] {
  return outlines.filter((o) => outlineBelongsToSkin(skinId, o))
}

/**
 * True when `outlineId` is that skin’s Base shell (`preferredDefaultOutlineId`).
 * Inherit / Copy UI is outline-gated: Base = hidden; any other outline = shown.
 */
export function isSkinBaseOutlineId(
  outlineId: string,
  preferredDefaultOutlineId?: string | null,
): boolean {
  const id = outlineId.trim()
  const base =
    typeof preferredDefaultOutlineId === 'string' ? preferredDefaultOutlineId.trim() : ''
  return Boolean(id && base && id === base)
}

/**
 * Pick which outline id to open for a skin: requested if it belongs to the skin,
 * else preferred Base, else first skin outline.
 */
export function resolveOutlineIdForSkin(options: {
  requestedId: string
  skinId: string
  preferredOutlineId?: string | null
  outlines: readonly { id: string; skinId?: string | null }[]
  fallbackId: string
}): string {
  const skinOutlines = filterOutlinesForSkin(options.outlines, options.skinId)
  if (skinOutlines.some((o) => o.id === options.requestedId)) {
    return options.requestedId
  }
  const preferred = options.preferredOutlineId?.trim()
  if (preferred && skinOutlines.some((o) => o.id === preferred)) {
    return preferred
  }
  return skinOutlines[0]?.id || options.fallbackId
}

export function listSkinOutlineSeeds(skin: Skin): SkinOutlineSeed[] {
  return Array.isArray(skin.outlineSeeds) ? skin.outlineSeeds : []
}

/** Find which registered skin owns an outline id (by prefix), if any. */
export function findSkinIdForOutline(
  outlineId: string,
  skins: readonly Skin[],
): string | null {
  for (const skin of skins) {
    if (isOutlineOwnedBySkin(skin.id, outlineId)) return skin.id
  }
  return null
}
