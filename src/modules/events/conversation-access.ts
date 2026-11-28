/**
 * Event conversation gates for Social’s comments engine.
 * Exported on `events-api` so Social can call them via loadModuleDoor.
 */

import 'server-only'

import { getAccessViewer } from '@/core/acl/access'

import { viewerCanViewEventContent } from './public-access'
import { findEventById, viewerCanManageEvent } from './store'

/**
 * True when the signed-in (or guest) viewer may see comments on this event.
 * Published + visibility + password unlock. Session must match viewerUserId.
 */
export async function viewerMayAccessEventConversation(
  eventId: string,
  viewerUserId: string | null,
): Promise<boolean> {
  const id = eventId.trim()
  if (!id) return false
  const event = await findEventById(id)
  if (!event || event.status !== 'published') return false

  const viewer = await getAccessViewer()
  const sessionId = viewer.userId?.trim() || null
  const asked = viewerUserId?.trim() || null
  if (asked && sessionId !== asked) return false

  return viewerCanViewEventContent(event, viewer)
}

/**
 * True when the viewer may moderate comments on this event
 * (app admin or assigned manager/helper).
 */
export async function viewerMayModerateEventConversation(
  eventId: string,
  viewerUserId: string | null,
): Promise<boolean> {
  const id = eventId.trim()
  const uid = viewerUserId?.trim() || null
  if (!id || !uid) return false
  const event = await findEventById(id)
  if (!event) return false

  const viewer = await getAccessViewer()
  if (viewer.userId?.trim() !== uid) return false
  return viewerCanManageEvent(event, viewer)
}
