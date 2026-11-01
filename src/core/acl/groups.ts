import { asc, count, eq, inArray } from 'drizzle-orm'

import { db, sfAclPermissions, sfUserGroupMembers, sfUserGroups } from '@/core/db'

import { slugifyGroupId } from './slug'
import type { UserGroup, UserGroupOption } from './types'

export type GroupWriteResult =
  | { ok: true; group: UserGroup }
  | { error: string }

function toMeta(
  row: typeof sfUserGroups.$inferSelect,
  memberCount: number,
): UserGroup {
  return {
    id: row.id,
    label: row.label,
    description: row.description,
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

export async function listUserGroups(): Promise<UserGroup[]> {
  const rows = await db.select().from(sfUserGroups).orderBy(asc(sfUserGroups.label))
  const counts = await memberCountsByGroup(rows.map((r) => r.id))
  return rows.map((row) => toMeta(row, counts.get(row.id) ?? 0))
}

export async function listUserGroupOptions(): Promise<UserGroupOption[]> {
  const rows = await db
    .select({ id: sfUserGroups.id, label: sfUserGroups.label })
    .from(sfUserGroups)
    .orderBy(asc(sfUserGroups.label))
  return rows
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
  const counts = await memberCountsByGroup([row.id])
  return toMeta(row, counts.get(row.id) ?? 0)
}

export async function createUserGroup(input: {
  label: string
  id?: string
  description?: string
}): Promise<GroupWriteResult> {
  const label = input.label.trim()
  if (!label) return { error: 'Group name is required.' }

  const id = slugifyGroupId(input.id?.trim() || label)
  if (!id) return { error: 'Group id must contain letters or numbers.' }

  const existing = await getUserGroup(id)
  if (existing) return { error: `Group id “${id}” already exists.` }

  const description = input.description?.trim() || null

  await db.insert(sfUserGroups).values({
    id,
    label,
    description,
  })

  const created = await getUserGroup(id)
  if (!created) return { error: 'Could not create group.' }
  return { ok: true, group: created }
}

export async function renameUserGroup(
  id: string,
  label: string,
  description?: string | null,
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

  await db
    .update(sfUserGroups)
    .set({
      label: nextLabel,
      description: nextDescription,
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

  // Members + ACL cascade via FK; nav items may still reference group:<id>
  // (treated as deny until reassigned).
  await db.delete(sfAclPermissions).where(eq(sfAclPermissions.groupId, trimmed))
  await db.delete(sfUserGroupMembers).where(eq(sfUserGroupMembers.groupId, trimmed))
  await db.delete(sfUserGroups).where(eq(sfUserGroups.id, trimmed))

  return { ok: true }
}

/** Seed a couple of starter groups when the table is empty. */
export async function ensureDefaultUserGroupsSeeded(): Promise<{
  created: string[]
}> {
  const existing = await listUserGroups()
  if (existing.length > 0) return { created: [] }

  const seeds = [
    {
      id: 'staff',
      label: 'Staff',
      description: 'Trusted site staff (nav + ACL stub grants).',
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
  return { created }
}
