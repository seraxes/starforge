import 'server-only'

import { cookies } from 'next/headers'

import { DEFAULT_LAYOUT_ID } from '@/core/db'

import {
  adminWorkingOutlineCookieName,
} from './admin-working-outline'
import { resolveOutlineIdForSkin } from './outline-meta'

/** Read last working outline for a skin (Layouts chrome sticky selection). */
export async function readAdminWorkingOutlineId(skinId: string): Promise<string | null> {
  const skin = skinId.trim()
  if (!skin) return null
  try {
    const jar = await cookies()
    const raw = jar.get(adminWorkingOutlineCookieName(skin))?.value
    if (!raw) return null
    const decoded = decodeURIComponent(raw).trim()
    return decoded || null
  } catch {
    return null
  }
}

/**
 * Resolve which outline the Layouts chrome should edit.
 * Prefer `?outline=` when set; else sticky cookie for this skin; else Base / fallback.
 */
export async function resolveAdminWorkingOutlineId(options: {
  /** Raw `?outline=` — empty/missing means “use sticky cookie”. */
  requestedId?: string | null
  skinId: string
  preferredOutlineId?: string | null
  outlines: readonly { id: string; skinId?: string | null }[]
  fallbackId?: string
}): Promise<string> {
  const fromUrl =
    typeof options.requestedId === 'string' && options.requestedId.trim()
      ? options.requestedId.trim()
      : ''
  const fromCookie = fromUrl ? null : await readAdminWorkingOutlineId(options.skinId)
  const requestedId = fromUrl || fromCookie || options.fallbackId || DEFAULT_LAYOUT_ID

  return resolveOutlineIdForSkin({
    requestedId,
    skinId: options.skinId,
    preferredOutlineId: options.preferredOutlineId,
    outlines: options.outlines,
    fallbackId: options.fallbackId || DEFAULT_LAYOUT_ID,
  })
}
