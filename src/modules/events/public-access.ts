/**
 * Public event access checks — ACL + optional password unlock.
 */

import 'server-only'

import type { AccessViewer } from '@/core/acl/types'
import { canSeeNavAccessTags } from '@/core/acl/nav-access'

import { hasEventPasswordUnlock } from './access-password'
import { categoryAllowsViewer, findEventCategoryById } from './categories'
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
 * Event ACL plus the category gate.
 * Uncategorized events only use the event tags. A category must be published
 * and match the viewer before its events are public.
 */
export async function viewerPassesEventVisibility(
  event: Pick<EventRecord, 'accessTags' | 'categoryId'>,
  viewer: AccessViewer,
): Promise<boolean> {
  if (!viewerPassesEventAcl(event, viewer)) return false
  if (!event.categoryId.trim()) return true
  const category = await findEventCategoryById(event.categoryId)
  return categoryAllowsViewer(event.categoryId, category, viewer)
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

/** Published + listed events the viewer may discover (event ACL and category gate). */
export async function filterDiscoverableEvents(
  events: Array<EventRecord | null | undefined>,
  viewer: AccessViewer,
): Promise<EventRecord[]> {
  const out: EventRecord[] = []
  for (const event of events) {
    if (!event || event.status !== 'published' || !event.listed) continue
    if (await viewerPassesEventVisibility(event, viewer)) out.push(event)
  }
  return out
}

export async function viewerCanViewEventContent(
  event: EventRecord,
  viewer: AccessViewer,
): Promise<boolean> {
  if (!(await viewerPassesEventVisibility(event, viewer))) return false
  return viewerPassesEventPassword(event, viewer)
}
