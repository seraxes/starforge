import 'server-only'

import { cache } from 'react'

import {
  getDefaultSkin,
  getDefaultSkinId,
  getSkin,
  isRegisteredSkinId,
} from './registry'
import { getStoredDefaultSkinId } from './settings-store'
import type { Skin, SkinId } from './types'

/**
 * Active skin id — env `STARFORGE_SKIN` (ops override) → stored admin default → pastel.
 * Unknown ids fall back so a typo never blanks the public brand.
 */
export const getActiveSkinId = cache(async (): Promise<SkinId> => {
  const raw = (process.env.STARFORGE_SKIN ?? '').trim()
  if (raw && isRegisteredSkinId(raw)) return raw

  try {
    const stored = await getStoredDefaultSkinId()
    if (stored && isRegisteredSkinId(stored)) return stored
  } catch {
    // settings table missing until migrate — use default
  }

  return getDefaultSkinId()
})

export const getActiveSkin = cache(async (): Promise<Skin> => {
  const id = await getActiveSkinId()
  return getSkin(id) ?? getDefaultSkin()
})

/** Whether the env override is pinning the active skin (admin default ignored). */
export function isSkinPinnedByEnv(): boolean {
  const raw = (process.env.STARFORGE_SKIN ?? '').trim()
  return Boolean(raw && isRegisteredSkinId(raw))
}
