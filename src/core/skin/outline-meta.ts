import type { Skin, SkinOutlineSeed } from './types'

/** Whether an outline id is owned by a skin package (id prefix convention). */
export function isOutlineOwnedBySkin(skinId: string, outlineId: string): boolean {
  const id = outlineId.trim()
  const skin = skinId.trim()
  if (!id || !skin) return false
  return id === skin || id.startsWith(`${skin}-`)
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
