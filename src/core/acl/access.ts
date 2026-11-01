import { userIsAppAdmin } from '@/core/auth/admin'
import { getAppSession } from '@/core/auth/session'
import type { NavItem } from '@/core/settings/defaults'

import { listGroupIdsForUser } from './members'
import { anyGroupAllowsResource } from './permissions'
import type { AccessViewer, AclAdminResourceKey } from './types'

/** Build viewer context from the current Better Auth session. */
export async function getAccessViewer(): Promise<AccessViewer> {
  const session = await getAppSession()
  const user = session?.user
  if (!user?.id) {
    return {
      userId: null,
      isRegistered: false,
      isAppAdmin: false,
      groupIds: [],
    }
  }

  const groupIds = await listGroupIdsForUser(user.id)
  return {
    userId: user.id,
    isRegistered: true,
    isAppAdmin: userIsAppAdmin(user),
    groupIds,
  }
}

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

/**
 * Stub ACL check for admin areas.
 * Global app admins always pass. Others need a group grant.
 * Core admin layout still uses `requireAppAdmin` today — this is the
 * foundation for expanding beyond role-only gates.
 */
export async function viewerMayAccessAdminResource(
  viewer: AccessViewer,
  resource: AclAdminResourceKey,
): Promise<boolean> {
  if (viewer.isAppAdmin) return true
  if (!viewer.isRegistered) return false
  return anyGroupAllowsResource(viewer.groupIds, resource)
}
