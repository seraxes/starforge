import type { NavItem } from '@/core/settings/defaults'

import type { AccessViewer } from './types'

/**
 * Pure nav visibility helpers (no session / next/headers).
 * Safe to import from shared code; viewer is passed in by the caller.
 */

/**
 * Whether a nav item’s accessLevel is visible to the viewer.
 * - missing / `public` → everyone
 * - `registered` → signed-in users
 * - `group:<id>` → members of that group (app admins always)
 */
export function canSeeNavAccessLevel(
  accessLevel: string | null | undefined,
  viewer: AccessViewer,
): boolean {
  const raw = (accessLevel || 'public').trim() || 'public'
  if (raw === 'public') return true
  if (viewer.isAppAdmin) return true
  if (raw === 'registered') return viewer.isRegistered
  if (raw.startsWith('group:')) {
    const groupId = raw.slice('group:'.length).trim()
    if (!groupId) return true
    return viewer.groupIds.includes(groupId)
  }
  return true
}

export function filterNavItemsForViewer<T extends NavItem>(
  items: T[],
  viewer: AccessViewer,
): T[] {
  return items.filter((item) => canSeeNavAccessLevel(item.accessLevel, viewer))
}
