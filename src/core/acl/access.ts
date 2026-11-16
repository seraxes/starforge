import 'server-only'

import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'

import {
  promoteSessionUserIfBootstrapAdmin,
  userIsAppAdmin,
} from '@/core/auth/admin'
import { db, sfUsers } from '@/core/db'
import { getAdminSession } from '@/core/auth/admin-session'
import { getAppSession } from '@/core/auth/session'

import {
  adminAreaGateForPath,
  decideAdminResourceAccess,
  decideAdminShellAccess,
  viewerAllowsGate,
} from './decide'
import { listGroupIdsForUser } from './members'
import { listAdminLevelsForGroups } from './permissions'
import { aclLevelSatisfies, highestAclLevel, type AclGrantLevel } from './levels'
import type { AccessViewer, AclAdminResourceKey } from './types'

/**
 * Session-bound ACL helpers only.
 * Pure nav/tag helpers live in `nav-access.ts` (client-safe) — do not re-export
 * them from this file or they inherit `server-only` via the barrel.
 */

async function viewerFromSessionUser(
  user: { id: string; role?: string | null; email?: string | null } | null | undefined,
): Promise<AccessViewer> {
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

/** Build viewer context from the public Better Auth session (never the admin cookie). */
export async function getAccessViewer(): Promise<AccessViewer> {
  const session = await getAppSession()
  return viewerFromSessionUser(session?.user)
}

/** Build viewer context from the staff admin session cookie. */
export async function getAdminAccessViewer(): Promise<AccessViewer> {
  const session = await getAdminSession()
  return viewerFromSessionUser(session?.user)
}

/**
 * Admin resources granted by an active subscription period (not ACL rows).
 * Organizer premium → `events.manage` → `admin.events`.
 */
async function subscriptionAdminResources(
  userId: string | null,
): Promise<Array<{ key: AclAdminResourceKey; level: AclGrantLevel }>> {
  if (!userId) return []
  try {
    const { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } = await import(
      '@/core/settings'
    )
    const settings = await getSiteSettings()
    if (!isCatalogModuleEnabled(settings, MODULE_IDS.subscriptions)) return []
    const { loadModuleDoor } = await import('@/generated/module-registry.server')
    const door = await loadModuleDoor('subscriptions-api')
    if (!door) return []
    const hasEntitlement = door.hasEntitlement as (
      userId: string,
      key: string,
    ) => Promise<boolean>
    const keys = door.ENTITLEMENT_KEYS as { eventsManage: string }
    if (await hasEntitlement(userId, keys.eventsManage)) {
      return [{ key: 'admin.events', level: 'manage' }]
    }
  } catch {
    /* pack missing / migrate pending */
  }
  return []
}

function putLevel(
  levels: Map<AclAdminResourceKey, AclGrantLevel>,
  key: AclAdminResourceKey,
  level: AclGrantLevel,
) {
  levels.set(key, highestAclLevel([levels.get(key), level]) ?? level)
}

/** Highest grant per admin resource. Empty for anonymous. App admins do not need this map. */
export async function listViewerAdminLevels(
  viewer: AccessViewer,
): Promise<Map<AclAdminResourceKey, AclGrantLevel>> {
  if (!viewer.isRegistered) return new Map()
  const levels =
    viewer.groupIds.length > 0
      ? await listAdminLevelsForGroups(viewer.groupIds)
      : new Map<AclAdminResourceKey, AclGrantLevel>()
  for (const grant of await subscriptionAdminResources(viewer.userId)) {
    putLevel(levels, grant.key, grant.level)
  }
  if (viewer.userId && (await viewerHasPagesCmsAccess(viewer.userId))) {
    putLevel(levels, 'admin.pages', 'manage')
  }
  return levels
}

/** Allowed matrix keys the viewer can at least view. */
export async function listViewerAllowedAdminResources(
  viewer: AccessViewer,
): Promise<Set<AclAdminResourceKey>> {
  const levels = await listViewerAdminLevels(viewer)
  const allowed = new Set<AclAdminResourceKey>()
  for (const [key, level] of levels) {
    if (aclLevelSatisfies(level, 'view')) allowed.add(key)
  }
  return allowed
}

/** cms_access may edit brochure pages. Fail closed. Does not import the CMS bridge. */
async function viewerHasPagesCmsAccess(userId: string): Promise<boolean> {
  try {
    const [row] = await db
      .select({ cmsAccess: sfUsers.cmsAccess, banned: sfUsers.banned })
      .from(sfUsers)
      .where(eq(sfUsers.id, userId))
      .limit(1)
    return Boolean(row && !row.banned && row.cmsAccess)
  } catch {
    return false
  }
}

/**
 * Admin-area ACL check.
 * Global app admins always pass. Others need a group grant and/or a live
 * subscription entitlement (e.g. organizer premium → admin.events).
 */
export async function viewerMayAccessAdminResource(
  viewer: AccessViewer,
  resource: AclAdminResourceKey,
  minLevel: AclGrantLevel = 'view',
): Promise<boolean> {
  if (viewer.isAppAdmin) return true
  if (!viewer.isRegistered) return false
  const levels = await listViewerAdminLevels(viewer)
  return decideAdminResourceAccess({
    isAppAdmin: false,
    isRegistered: true,
    heldLevel: levels.get(resource) ?? null,
    minLevel,
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
export async function requireAdminArea(
  resource: AclAdminResourceKey,
  minLevel: AclGrantLevel = 'view',
) {
  const session = await getAdminSession()
  if (!session?.user) return null
  await promoteSessionUserIfBootstrapAdmin(session.user)

  const viewer = await viewerFromSessionUser(session.user)
  if (!(await viewerMayAccessAdminResource(viewer, resource, minLevel))) return null
  return session
}

/**
 * Enforce the ACL gate for the current Core admin request path (`x-sf-pathname`).
 * Returns the session when allowed; otherwise `null`.
 */
export async function requireAdminAreaForRequest() {
  const session = await getAdminSession()
  if (!session?.user) return null
  await promoteSessionUserIfBootstrapAdmin(session.user)

  const viewer = await viewerFromSessionUser(session.user)

  const headerList = await headers()
  const pathname = headerList.get('x-sf-pathname') || '/admin'
  const gate = adminAreaGateForPath(pathname)
  const allowed = viewer.isAppAdmin
    ? new Set<AclAdminResourceKey>()
    : await listViewerAllowedAdminResources(viewer)

  if (!viewerAllowsGate(viewer, gate, allowed)) return null
  return { session, viewer, allowed, gate, pathname }
}
