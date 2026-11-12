import 'server-only'

import { headers } from 'next/headers'

import {
  promoteSessionUserIfBootstrapAdmin,
  userIsAppAdmin,
} from '@/core/auth/admin'
import { getAppSession } from '@/core/auth/session'

import {
  adminAreaGateForPath,
  decideAdminResourceAccess,
  decideAdminShellAccess,
  viewerAllowsGate,
} from './decide'
import { listGroupIdsForUser } from './members'
import { listAllowedResourcesForGroups } from './permissions'
import type { AccessViewer, AclAdminResourceKey } from './types'

/**
 * Session-bound ACL helpers only.
 * Pure nav/tag helpers live in `nav-access.ts` (client-safe) — do not re-export
 * them from this file or they inherit `server-only` via the barrel.
 */

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
 * Admin resources granted by an active subscription period (not ACL rows).
 * Organizer premium → `events.manage` → `admin.events`.
 */
async function subscriptionAdminResources(
  userId: string | null,
): Promise<AclAdminResourceKey[]> {
  if (!userId) return []
  try {
    const { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } = await import(
      '@/core/settings'
    )
    const settings = await getSiteSettings()
    if (!isCatalogModuleEnabled(settings, MODULE_IDS.subscriptions)) return []
    const { hasEntitlement, ENTITLEMENT_KEYS } = await import(
      '@/modules/subscriptions/api'
    )
    if (await hasEntitlement(userId, ENTITLEMENT_KEYS.eventsManage)) {
      return ['admin.events']
    }
  } catch {
    /* pack missing / migrate pending */
  }
  return []
}

/** Allowed matrix keys for the viewer (empty for anonymous; unused for app admins). */
export async function listViewerAllowedAdminResources(
  viewer: AccessViewer,
): Promise<Set<AclAdminResourceKey>> {
  if (!viewer.isRegistered) {
    return new Set()
  }
  const allowed =
    viewer.groupIds.length > 0
      ? await listAllowedResourcesForGroups(viewer.groupIds)
      : new Set<AclAdminResourceKey>()
  for (const key of await subscriptionAdminResources(viewer.userId)) {
    allowed.add(key)
  }
  return allowed
}

/**
 * Admin-area ACL check.
 * Global app admins always pass. Others need a group grant and/or a live
 * subscription entitlement (e.g. organizer premium → admin.events).
 */
export async function viewerMayAccessAdminResource(
  viewer: AccessViewer,
  resource: AclAdminResourceKey,
): Promise<boolean> {
  if (viewer.isAppAdmin) return true
  if (!viewer.isRegistered) return false
  const allowed = await listViewerAllowedAdminResources(viewer)
  return decideAdminResourceAccess({
    isAppAdmin: false,
    isRegistered: true,
    groupAllows: allowed.has(resource),
  })
}

/** True when the viewer may enter `/admin` (app admin, ACL grant, or subscription access). */
export async function viewerMayEnterAdminShell(viewer: AccessViewer): Promise<boolean> {
  if (viewer.isAppAdmin) return true
  if (!viewer.isRegistered) return false
  const allowed = await listViewerAllowedAdminResources(viewer)
  return decideAdminShellAccess({
    isAppAdmin: false,
    isRegistered: true,
    hasAnyAdminGrant: allowed.size > 0,
  })
}

/**
 * Current session must pass the admin-area ACL for `resource`; otherwise `null`.
 * Prefer this over `requireAppAdmin` for areas listed on Users → ACL.
 */
export async function requireAdminArea(resource: AclAdminResourceKey) {
  const session = await getAppSession()
  if (!session?.user) return null
  await promoteSessionUserIfBootstrapAdmin(session.user)

  const viewer: AccessViewer = {
    userId: session.user.id,
    isRegistered: true,
    isAppAdmin: userIsAppAdmin(session.user),
    groupIds: await listGroupIdsForUser(session.user.id),
  }

  if (!(await viewerMayAccessAdminResource(viewer, resource))) return null
  return session
}

/**
 * Enforce the ACL gate for the current Core admin request path (`x-sf-pathname`).
 * Returns the session when allowed; otherwise `null`.
 */
export async function requireAdminAreaForRequest() {
  const session = await getAppSession()
  if (!session?.user) return null
  await promoteSessionUserIfBootstrapAdmin(session.user)

  const viewer: AccessViewer = {
    userId: session.user.id,
    isRegistered: true,
    isAppAdmin: userIsAppAdmin(session.user),
    groupIds: await listGroupIdsForUser(session.user.id),
  }

  const headerList = await headers()
  const pathname = headerList.get('x-sf-pathname') || '/admin'
  const gate = adminAreaGateForPath(pathname)
  const allowed = viewer.isAppAdmin
    ? new Set<AclAdminResourceKey>()
    : await listViewerAllowedAdminResources(viewer)

  if (!viewerAllowsGate(viewer, gate, allowed)) return null
  return { session, viewer, allowed, gate, pathname }
}
