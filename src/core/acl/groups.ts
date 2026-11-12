import 'server-only'

import { count, eq, inArray } from 'drizzle-orm'

import { db, sfAclPermissions, sfUserGroupMembers, sfUserGroups } from '@/core/db'

import {
  MAX_GROUP_DEPTH,
  depthUnderParent,
  groupDepth,
  maxRelativeSubtreeDepth,
  orderGroupsAsTree,
  wouldCreateCycle,
} from './hierarchy'
import { getGroupAclMatrix, replaceGroupAclMatrix, setGroupAclPermission } from './permissions'
import { slugifyGroupId } from './slug'
import type { UserGroup, UserGroupOption } from './types'

export type GroupWriteResult =
  | { ok: true; group: UserGroup }
  | { error: string }

export { expandGroupIdsWithAncestors, MAX_GROUP_DEPTH } from './hierarchy'

/** id → parentId for all groups (access expansion + validation). */
export async function listGroupParentMap(): Promise<Map<string, string | null>> {
  const rows = await db
    .select({ id: sfUserGroups.id, parentId: sfUserGroups.parentId })
    .from(sfUserGroups)
  return new Map(rows.map((r) => [r.id, r.parentId ?? null]))
}

function toMeta(
  row: typeof sfUserGroups.$inferSelect,
  memberCount: number,
  depth: number,
): UserGroup {
  return {
    id: row.id,
    label: row.label,
    description: row.description,
    parentId: row.parentId ?? null,
    depth,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    memberCount,
  }
}

async function memberCountsByGroup(
  groupIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (groupIds.length === 0) return map
  const rows = await db
    .select({
      groupId: sfUserGroupMembers.groupId,
      n: count(),
    })
    .from(sfUserGroupMembers)
    .where(inArray(sfUserGroupMembers.groupId, groupIds))
    .groupBy(sfUserGroupMembers.groupId)
  for (const row of rows) {
    map.set(row.groupId, Number(row.n) || 0)
  }
  return map
}

/**
 * Validate optional parent for create/rename.
 * `selfId` is the group being edited (omit on create).
 */
async function resolveParentId(
  parentIdRaw: string | null | undefined,
  selfId?: string,
): Promise<{ parentId: string | null } | { error: string }> {
  const parentId = parentIdRaw?.trim() || null
  if (!parentId) return { parentId: null }

  const parentById = await listGroupParentMap()
  if (!parentById.has(parentId)) {
    return { error: `Parent group “${parentId}” was not found.` }
  }

  if (selfId) {
    if (wouldCreateCycle(selfId, parentId, parentById)) {
      return {
        error: 'Parent cannot be the group itself or one of its descendants.',
      }
    }
    const nextDepth = depthUnderParent(parentId, parentById)
    const subtree = maxRelativeSubtreeDepth(selfId, parentById)
    if (nextDepth + subtree > MAX_GROUP_DEPTH) {
      return {
        error: `Group nesting cannot exceed ${MAX_GROUP_DEPTH} levels.`,
      }
    }
  } else {
    const nextDepth = depthUnderParent(parentId, parentById)
    if (nextDepth > MAX_GROUP_DEPTH) {
      return {
        error: `Group nesting cannot exceed ${MAX_GROUP_DEPTH} levels.`,
      }
    }
  }

  return { parentId }
}

export async function listUserGroups(): Promise<UserGroup[]> {
  const rows = await db.select().from(sfUserGroups)
  const counts = await memberCountsByGroup(rows.map((r) => r.id))
  const ordered = orderGroupsAsTree(
    rows.map((row) => ({
      ...row,
      parentId: row.parentId ?? null,
    })),
  )
  return ordered.map((row) => toMeta(row, counts.get(row.id) ?? 0, row.depth))
}

export async function listUserGroupOptions(): Promise<UserGroupOption[]> {
  const groups = await listUserGroups()
  return groups.map((g) => ({
    id: g.id,
    label: g.depth > 0 ? `${'—'.repeat(g.depth)} ${g.label}` : g.label,
  }))
}

export async function getUserGroup(id: string): Promise<UserGroup | null> {
  const trimmed = id.trim()
  if (!trimmed) return null
  const [row] = await db
    .select()
    .from(sfUserGroups)
    .where(eq(sfUserGroups.id, trimmed))
    .limit(1)
  if (!row) return null
  const parentById = await listGroupParentMap()
  const counts = await memberCountsByGroup([row.id])
  return toMeta(row, counts.get(row.id) ?? 0, groupDepth(row.id, parentById))
}

export async function createUserGroup(input: {
  label: string
  id?: string
  description?: string
  parentId?: string | null
}): Promise<GroupWriteResult> {
  const label = input.label.trim()
  if (!label) return { error: 'Group name is required.' }

  const id = slugifyGroupId(input.id?.trim() || label)
  if (!id) return { error: 'Group id must contain letters or numbers.' }

  const existing = await getUserGroup(id)
  if (existing) return { error: `Group id “${id}” already exists.` }

  const parentResolved = await resolveParentId(input.parentId)
  if ('error' in parentResolved) return { error: parentResolved.error }

  const description = input.description?.trim() || null

  await db.insert(sfUserGroups).values({
    id,
    label,
    description,
    parentId: parentResolved.parentId,
  })

  const created = await getUserGroup(id)
  if (!created) return { error: 'Could not create group.' }
  return { ok: true, group: created }
}

export async function renameUserGroup(
  id: string,
  label: string,
  description?: string | null,
  parentId?: string | null,
): Promise<GroupWriteResult> {
  const trimmedId = id.trim()
  if (!trimmedId) return { error: 'Missing group id.' }
  const nextLabel = label.trim()
  if (!nextLabel) return { error: 'Group name is required.' }

  const existing = await getUserGroup(trimmedId)
  if (!existing) return { error: 'Group not found.' }

  const nextDescription =
    description === undefined
      ? existing.description
      : description === null
        ? null
        : description.trim() || null

  let resolvedParentId = existing.parentId
  if (parentId !== undefined) {
    const resolved = await resolveParentId(parentId, trimmedId)
    if ('error' in resolved) return { error: resolved.error }
    resolvedParentId = resolved.parentId
  }

  await db
    .update(sfUserGroups)
    .set({
      label: nextLabel,
      description: nextDescription,
      parentId: resolvedParentId,
      updatedAt: new Date(),
    })
    .where(eq(sfUserGroups.id, trimmedId))

  const updated = await getUserGroup(trimmedId)
  if (!updated) return { error: 'Could not rename group.' }
  return { ok: true, group: updated }
}

export async function deleteUserGroup(
  id: string,
): Promise<{ ok: true } | { error: string }> {
  const trimmed = id.trim()
  if (!trimmed) return { error: 'Missing group id.' }

  const existing = await getUserGroup(trimmed)
  if (!existing) return { error: 'Group not found.' }

  const [child] = await db
    .select({ id: sfUserGroups.id })
    .from(sfUserGroups)
    .where(eq(sfUserGroups.parentId, trimmed))
    .limit(1)
  if (child) {
    return {
      error:
        'Reparent or delete child groups first — this group still has nested groups.',
    }
  }

  // Members + ACL cascade via FK; nav items may still reference group:<id>
  // (treated as deny until reassigned).
  await db.delete(sfAclPermissions).where(eq(sfAclPermissions.groupId, trimmed))
  await db.delete(sfUserGroupMembers).where(eq(sfUserGroupMembers.groupId, trimmed))
  await db.delete(sfUserGroups).where(eq(sfUserGroups.id, trimmed))

  return { ok: true }
}

/**
 * Upgrade path: Managers seeded before Dashboard D0 only had `admin.nav`.
 * Grant `admin.dashboard` so `/admin` is the landing (not kicked home / Users).
 * Idempotent — no-op when already allowed or group missing.
 */
export async function ensureManagersDashboardAcl(): Promise<{ healed: boolean }> {
  const managers = await getUserGroup('managers')
  if (!managers) return { healed: false }

  const matrix = await getGroupAclMatrix('managers')
  const dashboard = matrix.find((row) => row.resource === 'admin.dashboard')
  if (dashboard?.allowed) return { healed: false }

  await setGroupAclPermission('managers', 'admin.dashboard', true)
  return { healed: true }
}

/**
 * Upgrade path: Localization left Site Chrome (SF-239). Managers who already
 * had `admin.site-chrome` also get `admin.localization` so the moved page stays
 * reachable. Idempotent — no-op when Localization already allowed, Chrome not
 * granted, or group missing.
 */
export async function ensureManagersLocalizationAcl(): Promise<{ healed: boolean }> {
  const managers = await getUserGroup('managers')
  if (!managers) return { healed: false }

  const matrix = await getGroupAclMatrix('managers')
  const chrome = matrix.find((row) => row.resource === 'admin.site-chrome')
  if (!chrome?.allowed) return { healed: false }

  const localization = matrix.find((row) => row.resource === 'admin.localization')
  if (localization?.allowed) return { healed: false }

  await setGroupAclPermission('managers', 'admin.localization', true)
  return { healed: true }
}

/** Seed a couple of starter groups when the table is empty. */
export async function ensureDefaultUserGroupsSeeded(): Promise<{
  created: string[]
}> {
  const existing = await listUserGroups()
  if (existing.length > 0) {
    // Existing installs: still heal Managers → Dashboard after D0.
    await ensureManagersDashboardAcl()
    // Localization left Chrome — heal Managers who already had Chrome.
    await ensureManagersLocalizationAcl()
    return { created: [] }
  }

  const seeds = [
    {
      id: 'managers',
      label: 'Managers',
      description:
        'Site managers — grant admin areas under Users → ACL (group, not a Role).',
    },
    {
      id: 'staff',
      label: 'Staff',
      description: 'Trusted site staff (assign ACL grants as needed).',
    },
    {
      id: 'editors',
      label: 'Editors',
      description: 'Content editors (assign CMS access separately).',
    },
  ]

  const created: string[] = []
  for (const seed of seeds) {
    const result = await createUserGroup(seed)
    if ('ok' in result && result.ok) created.push(result.group.id)
  }

  // Default Managers model: Dashboard + Navigation (member-in-Managers can open /admin).
  if (created.includes('managers')) {
    await replaceGroupAclMatrix('managers', ['admin.dashboard', 'admin.nav'])
  }

  return { created }
}
