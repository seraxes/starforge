/**
 * Public event access checks — ACL + optional password unlock.
 */

import 'server-only'

import type { AccessViewer } from '@/core/acl/types'
import { canSeeNavAccessTags } from '@/core/acl/nav-access'

import { hasEventPasswordUnlock } from './access-password'
import { viewerCanManageEvent } from './store'
import type { EventRecord } from './types'

/** ACL only (groups / public / registered). */
export function viewerPassesEventAcl(
  event: Pick<EventRecord, 'accessTags'>,
  viewer: AccessViewer,
): boolean {
  return canSeeNavAccessTags(event.accessTags, viewer)
}

/**
 * True when the viewer may see event body / register / ICS.
 * Managers and app admins bypass the password gate.
 */
export async function viewerPassesEventPassword(
  event: Pick<EventRecord, 'id' | 'hasAccessPassword' | 'managerUserIds' | 'helperUserIds' | 'managerGroupIds' | 'helperGroupIds'>,
  viewer: AccessViewer,
): Promise<boolean> {
  if (!event.hasAccessPassword) return true
  if (viewerCanManageEvent(event, viewer)) return true
  return hasEventPasswordUnlock(event.id)
}

export async function viewerCanViewEventContent(
  event: EventRecord,
  viewer: AccessViewer,
): Promise<boolean> {
  if (!viewerPassesEventAcl(event, viewer)) return false
  return viewerPassesEventPassword(event, viewer)
}
