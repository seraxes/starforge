import 'server-only'

import { and, asc, eq, inArray } from 'drizzle-orm'

import { db, sfUserGroupMembers, sfUsers } from '@/core/db'

export type GroupMemberRow = {
  userId: string
  name: string
  email: string
  role: string
  joinedAt: Date
}

export async function listGroupMembers(groupId: string): Promise<GroupMemberRow[]> {
  const trimmed = groupId.trim()
  if (!trimmed) return []

  const rows = await db
    .select({
      userId: sfUserGroupMembers.userId,
      name: sfUsers.name,
      email: sfUsers.email,
      role: sfUsers.role,
      joinedAt: sfUserGroupMembers.createdAt,
    })
    .from(sfUserGroupMembers)
    .innerJoin(sfUsers, eq(sfUsers.id, sfUserGroupMembers.userId))
    .where(eq(sfUserGroupMembers.groupId, trimmed))
    .orderBy(asc(sfUsers.email))

  return rows
}

export async function listGroupIdsForUser(userId: string): Promise<string[]> {
  const trimmed = userId.trim()
  if (!trimmed) return []
  const rows = await db
    .select({ groupId: sfUserGroupMembers.groupId })
    .from(sfUserGroupMembers)
    .where(eq(sfUserGroupMembers.userId, trimmed))
  return rows.map((r) => r.groupId)
}

/** Map of userId → group ids (for the Users admin table). */
export async function listGroupIdsByUserIds(
  userIds: string[],
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>()
  if (userIds.length === 0) return map
  const rows = await db
    .select({
      userId: sfUserGroupMembers.userId,
      groupId: sfUserGroupMembers.groupId,
    })
    .from(sfUserGroupMembers)
    .where(inArray(sfUserGroupMembers.userId, userIds))
  for (const row of rows) {
    const list = map.get(row.userId) ?? []
    list.push(row.groupId)
    map.set(row.userId, list)
  }
  return map
}

export async function addUserToGroup(
  groupId: string,
  userId: string,
): Promise<{ ok: true } | { error: string }> {
  const g = groupId.trim()
  const u = userId.trim()
  if (!g || !u) return { error: 'Group and user are required.' }

  const [user] = await db
    .select({ id: sfUsers.id })
    .from(sfUsers)
    .where(eq(sfUsers.id, u))
    .limit(1)
  if (!user) return { error: 'User not found.' }

  try {
    await db
      .insert(sfUserGroupMembers)
      .values({ groupId: g, userId: u })
      .onConflictDoNothing()
  } catch {
    return { error: 'Could not add user to group.' }
  }
  return { ok: true }
}

export async function removeUserFromGroup(
  groupId: string,
  userId: string,
): Promise<{ ok: true } | { error: string }> {
  const g = groupId.trim()
  const u = userId.trim()
  if (!g || !u) return { error: 'Group and user are required.' }

  await db
    .delete(sfUserGroupMembers)
    .where(
      and(eq(sfUserGroupMembers.groupId, g), eq(sfUserGroupMembers.userId, u)),
    )
  return { ok: true }
}

/**
 * Replace a user’s full group membership set (Users admin multi-assign).
 */
export async function setUserGroups(
  userId: string,
  groupIds: string[],
): Promise<{ ok: true } | { error: string }> {
  const u = userId.trim()
  if (!u) return { error: 'Missing user id.' }

  const [user] = await db
    .select({ id: sfUsers.id })
    .from(sfUsers)
    .where(eq(sfUsers.id, u))
    .limit(1)
  if (!user) return { error: 'User not found.' }

  const unique = [...new Set(groupIds.map((id) => id.trim()).filter(Boolean))]

  await db.delete(sfUserGroupMembers).where(eq(sfUserGroupMembers.userId, u))
  if (unique.length > 0) {
    await db.insert(sfUserGroupMembers).values(
      unique.map((groupId) => ({ groupId, userId: u })),
    )
  }
  return { ok: true }
}
