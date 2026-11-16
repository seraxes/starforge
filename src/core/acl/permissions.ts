import 'server-only'

import { and, eq, inArray } from 'drizzle-orm'

import { db, sfAclPermissions } from '@/core/db'

import {
  aclLevelSatisfies,
  grantLevelFromRow,
  highestAclLevel,
  isAclGrantLevel,
  type AclGrantLevel,
} from './levels'
import {
  ACL_ADMIN_RESOURCES,
  isAclAdminResourceKey,
  type AclAdminResourceKey,
  type AclPermissionRow,
} from './types'

function permissionId(groupId: string, resource: string): string {
  return `acl_${groupId}__${resource.replace(/[^a-z0-9]+/gi, '_')}`
}

function storedLevel(level: AclGrantLevel | null): { level: string; allowed: boolean } {
  if (!level) return { level: 'none', allowed: false }
  return { level, allowed: true }
}

/** Full matrix for one group (missing rows = no grant). */
export async function getGroupAclMatrix(groupId: string): Promise<AclPermissionRow[]> {
  const trimmed = groupId.trim()
  const rows = trimmed
    ? await db
        .select({
          resource: sfAclPermissions.resource,
          level: sfAclPermissions.level,
          allowed: sfAclPermissions.allowed,
        })
        .from(sfAclPermissions)
        .where(eq(sfAclPermissions.groupId, trimmed))
    : []

  const byResource = new Map(
    rows.map((row) => [row.resource, grantLevelFromRow(row.level, Boolean(row.allowed))]),
  )

  return ACL_ADMIN_RESOURCES.map((res) => {
    const level = byResource.get(res.key) ?? null
    return {
      resource: res.key,
      label: res.label,
      level,
      allowed: level != null,
    }
  })
}

export async function setGroupAclPermission(
  groupId: string,
  resource: AclAdminResourceKey,
  allowedOrLevel: boolean | AclGrantLevel | null,
): Promise<{ ok: true } | { error: string }> {
  const g = groupId.trim()
  if (!g) return { error: 'Missing group id.' }
  if (!isAclAdminResourceKey(resource)) return { error: 'Unknown ACL resource.' }

  const level: AclGrantLevel | null =
    allowedOrLevel === true
      ? 'manage'
      : allowedOrLevel === false || allowedOrLevel == null
        ? null
        : isAclGrantLevel(allowedOrLevel)
          ? allowedOrLevel
          : null

  const stored = storedLevel(level)
  const id = permissionId(g, resource)
  const existing = await db
    .select({ id: sfAclPermissions.id })
    .from(sfAclPermissions)
    .where(and(eq(sfAclPermissions.groupId, g), eq(sfAclPermissions.resource, resource)))
    .limit(1)

  if (existing[0]) {
    await db
      .update(sfAclPermissions)
      .set({ ...stored, updatedAt: new Date() })
      .where(eq(sfAclPermissions.id, existing[0].id))
  } else {
    await db.insert(sfAclPermissions).values({
      id,
      groupId: g,
      resource,
      ...stored,
    })
  }
  return { ok: true }
}

/** Replace the whole matrix. A string list means those resources are `manage` and the rest are none. */
export async function replaceGroupAclMatrix(
  groupId: string,
  allowedResources: string[],
): Promise<{ ok: true } | { error: string }> {
  const allowed = new Set(
    allowedResources.filter((r): r is AclAdminResourceKey => isAclAdminResourceKey(r)),
  )
  const levels = new Map<AclAdminResourceKey, AclGrantLevel | null>()
  for (const res of ACL_ADMIN_RESOURCES) {
    levels.set(res.key, allowed.has(res.key) ? 'manage' : null)
  }
  return replaceGroupAclLevels(groupId, levels)
}

/** Replace the whole matrix from explicit levels. Missing keys become none. */
export async function replaceGroupAclLevels(
  groupId: string,
  levels: ReadonlyMap<string, AclGrantLevel | null>,
): Promise<{ ok: true } | { error: string }> {
  const g = groupId.trim()
  if (!g) return { error: 'Missing group id.' }

  for (const res of ACL_ADMIN_RESOURCES) {
    const raw = levels.get(res.key) ?? null
    const level = isAclGrantLevel(raw) ? raw : null
    const result = await setGroupAclPermission(g, res.key, level)
    if ('error' in result) return result
  }
  return { ok: true }
}

/**
 * True when any of the given groups can at least view the resource.
 * App admins should bypass this (see `viewerMayAccessAdminResource`).
 */
export async function anyGroupAllowsResource(
  groupIds: string[],
  resource: AclAdminResourceKey,
  minLevel: AclGrantLevel = 'view',
): Promise<boolean> {
  const levels = await listAdminLevelsForGroups(groupIds)
  return aclLevelSatisfies(levels.get(resource) ?? null, minLevel)
}

/** Distinct resources the groups can at least view. */
export async function listAllowedResourcesForGroups(
  groupIds: string[],
): Promise<Set<AclAdminResourceKey>> {
  const levels = await listAdminLevelsForGroups(groupIds)
  const out = new Set<AclAdminResourceKey>()
  for (const [resource, level] of levels) {
    if (aclLevelSatisfies(level, 'view')) out.add(resource)
  }
  return out
}

/** Highest grant per resource across the given groups. */
export async function listAdminLevelsForGroups(
  groupIds: string[],
): Promise<Map<AclAdminResourceKey, AclGrantLevel>> {
  const buckets = new Map<AclAdminResourceKey, AclGrantLevel[]>()
  if (groupIds.length === 0) return new Map()
  const rows = await db
    .select({
      resource: sfAclPermissions.resource,
      level: sfAclPermissions.level,
      allowed: sfAclPermissions.allowed,
    })
    .from(sfAclPermissions)
    .where(inArray(sfAclPermissions.groupId, groupIds))
  for (const row of rows) {
    if (!isAclAdminResourceKey(row.resource)) continue
    const level = grantLevelFromRow(row.level, Boolean(row.allowed))
    if (!level) continue
    const list = buckets.get(row.resource) ?? []
    list.push(level)
    buckets.set(row.resource, list)
  }
  const out = new Map<AclAdminResourceKey, AclGrantLevel>()
  for (const [resource, levels] of buckets) {
    const best = highestAclLevel(levels)
    if (best) out.set(resource, best)
  }
  return out
}
