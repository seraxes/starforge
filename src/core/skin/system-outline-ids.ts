/**
 * Pure id helpers for pack system outlines (Offline + 404).
 * Keep free of `server-only` so unit tests and clients can import.
 */
import {
  STARFORGE_PASTEL_NOT_FOUND_OUTLINE_ID,
  STARFORGE_PASTEL_OFFLINE_OUTLINE_ID,
} from './registry'

export type SkinSystemOutlineKind = 'offline' | 'not-found'

export function skinSystemOutlineId(skinId: string, kind: SkinSystemOutlineKind): string {
  const skin = skinId.trim()
  if (!skin) {
    return kind === 'offline' ? STARFORGE_PASTEL_OFFLINE_OUTLINE_ID : STARFORGE_PASTEL_NOT_FOUND_OUTLINE_ID
  }
  return kind === 'offline' ? `${skin}-offline` : `${skin}-not-found`
}

export function pastelSystemOutlineFallback(kind: SkinSystemOutlineKind): string {
  return kind === 'offline' ? STARFORGE_PASTEL_OFFLINE_OUTLINE_ID : STARFORGE_PASTEL_NOT_FOUND_OUTLINE_ID
}
