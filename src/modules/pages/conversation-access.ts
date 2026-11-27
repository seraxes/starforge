/**
 * CMS page conversation gates for Social’s comments engine.
 * Exported on `pages-api` so Social can call them via loadModuleDoor.
 */

import 'server-only'

import {
  getAccessViewer,
  viewerMayAccessAdminResource,
} from '@/core/acl/access'

import { findPageById } from './store'

/**
 * True when the viewer may see comments on this CMS page.
 * Published pages are public. Draft / unpublished need pages edit.
 */
export async function viewerMayAccessPageConversation(
  pageId: string,
  viewerUserId: string | null,
): Promise<boolean> {
  const id = pageId.trim()
  if (!id) return false
  const page = await findPageById(id)
  if (!page) return false

  if (page.status === 'published') return true

  const viewer = await getAccessViewer()
  const sessionId = viewer.userId?.trim() || null
  const asked = viewerUserId?.trim() || null
  if (asked && sessionId !== asked) return false
  if (!sessionId) return false
  return viewerMayAccessAdminResource(viewer, 'admin.pages', 'edit')
}

/**
 * True when the viewer may moderate comments on this CMS page
 * (app admin or admin.pages edit).
 */
export async function viewerMayModeratePageConversation(
  pageId: string,
  viewerUserId: string | null,
): Promise<boolean> {
  const id = pageId.trim()
  const uid = viewerUserId?.trim() || null
  if (!id || !uid) return false
  const page = await findPageById(id)
  if (!page) return false

  const viewer = await getAccessViewer()
  if (viewer.userId?.trim() !== uid) return false
  return viewerMayAccessAdminResource(viewer, 'admin.pages', 'edit')
}
