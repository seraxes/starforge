/**
 * System outlines every skin pack seeds beside Base: Offline + 404.
 * Active skin always owns these pages — `{skinId}-offline` / `{skinId}-not-found`.
 */
import 'server-only'

import { getLayoutOutline } from '@/core/modules/layout-store'

import { outlineBelongsToSkin } from './outline-meta'
import { ensureSkinOutlineSeeds } from './outline-seeds'
import { getActiveSkin } from './resolve-active'
import {
  pastelSystemOutlineFallback,
  skinSystemOutlineId,
  type SkinSystemOutlineKind,
} from './system-outline-ids'

export type { SkinSystemOutlineKind } from './system-outline-ids'
export { skinSystemOutlineId } from './system-outline-ids'

/**
 * Resolve which outline the active theme uses for Offline or 404.
 * Chrome may pick an outline; honored only when it belongs to the active skin.
 * Otherwise the pack’s `{skinId}-offline` / `{skinId}-not-found`.
 */
export async function resolveActiveSkinSystemOutlineId(
  kind: SkinSystemOutlineKind,
  options?: { chromeOverride?: string | null },
): Promise<{ skinId: string; outlineId: string }> {
  const activeSkin = await getActiveSkin()
  await ensureSkinOutlineSeeds(activeSkin.id)

  const override = typeof options?.chromeOverride === 'string' ? options.chromeOverride.trim() : ''
  if (override) {
    try {
      const meta = await getLayoutOutline(override)
      if (meta && outlineBelongsToSkin(activeSkin.id, meta)) {
        return { skinId: activeSkin.id, outlineId: override }
      }
    } catch {
      // fall through to pack id
    }
  }

  const packId = skinSystemOutlineId(activeSkin.id, kind)
  try {
    const meta = await getLayoutOutline(packId)
    if (meta) return { skinId: activeSkin.id, outlineId: packId }
  } catch {
    // table may be missing
  }

  return { skinId: activeSkin.id, outlineId: pastelSystemOutlineFallback(kind) }
}
