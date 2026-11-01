import 'server-only'

import { and, eq, inArray } from 'drizzle-orm'

import { db, sfAclPermissions } from '@/core/db'

import {
  ACL_ADMIN_RESOURCES,
  isAclAdminResourceKey,
  type AclAdminResourceKey,
  type AclPermissionRow,
} from './types'

function permissionId(groupId: string, resource: string): string {
  return `acl_${groupId}__${resource.replace(/[^a-z0-9]+/gi, '_')}`
}

/** Full stub matrix for one group (missing rows = denied). */
export async function getGroupAclMatrix(groupId: string): Promise<AclPermissionRow[]> {
  const trimmed = groupId.trim()
  const rows = trimmed
    ? await db
        .select({
          resource: sfAclPermissions.resource,
          allowed: sfAclPermissions.allowed,
        })
        .from(sfAclPermissions)
        .where(eq(sfAclPermissions.groupId, trimmed))
    : []

  const byResource = new Map(rows.map((r) => [r.resource, Boolean(r.allowed)]))

  return ACL_ADMIN_RESOURCES.map((res) => ({
    resource: res.key,
    label: res.label,
    allowed: byResource.get(res.key) === true,
  }))
}

export async function setGroupAclPermission(
  groupId: string,
  resource: AclAdminResourceKey,
  allowed: boolean,
): Promise<{ ok: true } | { error: string }> {
  const g = groupId.trim()
  if (!g) return { error: 'Missing group id.' }
  if (!isAclAdminResourceKey(resource)) return { error: 'Unknown ACL resource.' }

  const id = permissionId(g, resource)
  const existing = await db
    .select({ id: sfAclPermissions.id })
    .from(sfAclPermissions)
    .where(
      and(eq(sfAclPermissions.groupId, g), eq(sfAclPermissions.resource, resource)),
    )
    .limit(1)

  if (existing[0]) {
    await db
      .update(sfAclPermissions)
      .set({ allowed, updatedAt: new Date() })
      .where(eq(sfAclPermissions.id, existing[0].id))
  } else {
    await db.insert(sfAclPermissions).values({
      id,
      groupId: g,
      resource,
      allowed,
    })
  }
  return { ok: true }
}

/** Replace the whole matrix for a group from a list of allowed resource keys. */
export async function replaceGroupAclMatrix(
  groupId: string,
  allowedResources: string[],
): Promise<{ ok: true } | { error: string }> {
  const g = groupId.trim()
  if (!g) return { error: 'Missing group id.' }

  const allowed = new Set(
    allowedResources.filter((r): r is AclAdminResourceKey => isAclAdminResourceKey(r)),
  )

  for (const res of ACL_ADMIN_RESOURCES) {
    const result = await setGroupAclPermission(g, res.key, allowed.has(res.key))
    if ('error' in result) return result
  }
  return { ok: true }
}

/**
 * True when any of the given groups has `allowed` for the resource.
 * App admins should bypass this (see `groupMayAccessAdminResource`).
 */
export async function anyGroupAllowsResource(
  groupIds: string[],
  resource: AclAdminResourceKey,
): Promise<boolean> {
  if (groupIds.length === 0) return false
  const rows = await db
    .select({ allowed: sfAclPermissions.allowed })
    .from(sfAclPermissions)
    .where(
      and(
        inArray(sfAclPermissions.groupId, groupIds),
        eq(sfAclPermissions.resource, resource),
        eq(sfAclPermissions.allowed, true),
      ),
    )
    .limit(1)
  return rows.length > 0
}
