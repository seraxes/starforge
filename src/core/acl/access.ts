import 'server-only'

import { userIsAppAdmin } from '@/core/auth/admin'
import { getAppSession } from '@/core/auth/session'

import { listGroupIdsForUser } from './members'
import {
  canSeeNavAccessLevel,
  canSeeNavAccessTags,
  filterNavItemsForViewer,
  normalizeAccessTags,
} from './nav-access'
import { anyGroupAllowsResource } from './permissions'
import type { AccessViewer, AclAdminResourceKey } from './types'

export {
  canSeeNavAccessLevel,
  canSeeNavAccessTags,
  filterNavItemsForViewer,
  normalizeAccessTags,
}

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
