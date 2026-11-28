/**
 * product:social member persistence (sf_social_members).
 * One row per userId. bannedAt is the Social ban flag for canInteract.
 * hiddenAt is the account-hide flag (slice 10) — hide keeps rows.
 */

import 'server-only'

import { desc, eq, isNotNull } from 'drizzle-orm'

import { db } from '@/core/db'

import {
  decideBanMember,
  decideUnbanMember,
  isSocialAccountHidden,
  type BanMemberInput,
  type MemberMutationResult,
  type MemberRecord,
  type UnbanMemberInput,
} from './members'
import { sfSocialMembers } from './schema'

function mapRow(row: typeof sfSocialMembers.$inferSelect): MemberRecord {
  return {
    userId: row.userId,
    bannedAt: row.bannedAt,
    hiddenAt: row.hiddenAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function findMember(userId: string): Promise<MemberRecord | null> {
  const id = userId.trim()
  if (!id) return null
  try {
    const rows = await db
      .select()
      .from(sfSocialMembers)
      .where(eq(sfSocialMembers.userId, id))
      .limit(1)
    return rows[0] ? mapRow(rows[0]) : null
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_members|does not exist|relation/i.test(msg)) return null
    throw error
  }
}

/** Member bannedAt, or null when no row / not banned / table missing. */
export async function getMemberBannedAt(userId: string): Promise<Date | null> {
  const row = await findMember(userId)
  return row?.bannedAt ?? null
}

/** Member hiddenAt, or null when no row / not hidden / table missing. */
export async function getMemberHiddenAt(userId: string): Promise<Date | null> {
  const row = await findMember(userId)
  return row?.hiddenAt ?? null
}

/** True when Social account hide is set for this userId. */
export async function isMemberAccountHidden(userId: string): Promise<boolean> {
  return isSocialAccountHidden(await getMemberHiddenAt(userId))
}

/** Banned members for the People admin list (bannedAt set). */
export async function listBannedMembers(opts?: {
  limit?: number
}): Promise<MemberRecord[]> {
  const limit = Math.min(Math.max(opts?.limit ?? 100, 1), 500)
  try {
    const rows = await db
      .select()
      .from(sfSocialMembers)
      .where(isNotNull(sfSocialMembers.bannedAt))
      .orderBy(desc(sfSocialMembers.bannedAt))
      .limit(limit)
    return rows.map(mapRow)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_members|does not exist|relation/i.test(msg)) return []
    throw error
  }
}

/** User ids with Social `bannedAt` set (for People suggestions omit). */
export async function listSocialBannedUserIds(): Promise<Set<string>> {
  try {
    const rows = await db
      .select({ userId: sfSocialMembers.userId })
      .from(sfSocialMembers)
      .where(isNotNull(sfSocialMembers.bannedAt))
    return new Set(rows.map((row) => row.userId.trim()).filter(Boolean))
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_members|does not exist|relation|banned_at/i.test(msg)) {
      return new Set()
    }
    throw error
  }
}

/** User ids with Social `hiddenAt` set (for feed / directory omit). */
export async function listSocialHiddenUserIds(): Promise<Set<string>> {
  try {
    const rows = await db
      .select({ userId: sfSocialMembers.userId })
      .from(sfSocialMembers)
      .where(isNotNull(sfSocialMembers.hiddenAt))
    return new Set(rows.map((row) => row.userId.trim()).filter(Boolean))
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_members|does not exist|relation|hidden_at/i.test(msg)) {
      return new Set()
    }
    throw error
  }
}

export async function banMember(
  input: BanMemberInput,
  gates: { canManageReports: boolean },
): Promise<MemberMutationResult> {
  const current = await findMember(input.userId)
  const result = decideBanMember(current, input, gates)
  if (!result.ok) return result

  const next = result.member
  try {
    await db
      .insert(sfSocialMembers)
      .values({
        userId: next.userId,
        bannedAt: next.bannedAt,
        hiddenAt: next.hiddenAt,
        createdAt: next.createdAt,
        updatedAt: next.updatedAt,
      })
      .onConflictDoUpdate({
        target: [sfSocialMembers.userId],
        set: {
          bannedAt: next.bannedAt,
          updatedAt: next.updatedAt,
        },
      })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_members|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'invalid' }
    }
    throw error
  }

  const stored = await findMember(next.userId)
  return stored ? { ok: true, member: stored } : { ok: true, member: next }
}

export async function unbanMember(
  input: UnbanMemberInput,
  gates: { canManageReports: boolean },
): Promise<MemberMutationResult> {
  const current = await findMember(input.userId)
  const result = decideUnbanMember(current, input, gates)
  if (!result.ok) return result

  const next = result.member
  try {
    await db
      .update(sfSocialMembers)
      .set({
        bannedAt: next.bannedAt,
        updatedAt: next.updatedAt,
      })
      .where(eq(sfSocialMembers.userId, next.userId))
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_members|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'invalid' }
    }
    throw error
  }

  const stored = await findMember(next.userId)
  return stored ? { ok: true, member: stored } : { ok: true, member: next }
}

/**
 * Persist account hide (`hiddenAt`). Keeps all other Social rows.
 * Upserts the one member row per userId.
 */
export async function setMemberHiddenAt(
  userId: string,
  hiddenAt: Date | null,
  opts?: { now?: Date },
): Promise<MemberRecord | null> {
  const id = userId.trim()
  if (!id) return null
  const now = opts?.now ?? new Date()
  const current = await findMember(id)
  const next: MemberRecord = current
    ? { ...current, hiddenAt, updatedAt: now }
    : {
        userId: id,
        bannedAt: null,
        hiddenAt,
        createdAt: now,
        updatedAt: now,
      }

  try {
    await db
      .insert(sfSocialMembers)
      .values({
        userId: next.userId,
        bannedAt: next.bannedAt,
        hiddenAt: next.hiddenAt,
        createdAt: next.createdAt,
        updatedAt: next.updatedAt,
      })
      .onConflictDoUpdate({
        target: [sfSocialMembers.userId],
        set: {
          hiddenAt: next.hiddenAt,
          updatedAt: next.updatedAt,
        },
      })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_members|does not exist|relation/i.test(msg)) return null
    throw error
  }

  return (await findMember(id)) ?? next
}
