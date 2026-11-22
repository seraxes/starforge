/**
 * product:social — staff grant for moderate / private-read.
 *
 * Same check as edit/delete/audience on any post: app admin (developer included)
 * via viewerMayOverrideMemberOwnership, or admin.social edit.
 * Do not invent a second grant. See sf-staff-bypass + 2026-11-22-staff-bypass-limits.
 */

import 'server-only'

/**
 * True when the signed-in member may moderate Social content and read private
 * front-end posts (only_me / friends / group without membership).
 */
export async function viewerMayModerateSocialContent(
  userId: string,
): Promise<boolean> {
  const id = userId.trim()
  if (!id) return false
  const {
    getAccessViewer,
    viewerMayAccessAdminResource,
    viewerMayOverrideMemberOwnership,
  } = await import('@/core/acl/access')
  const viewer = await getAccessViewer()
  if (!viewer.userId || viewer.userId !== id) return false
  if (viewerMayOverrideMemberOwnership(viewer)) return true
  return viewerMayAccessAdminResource(viewer, 'admin.social', 'edit')
}
