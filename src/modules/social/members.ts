/**
 * product:social member row — Social ban (`bannedAt`) and account hide (`hiddenAt`).
 *
 * One row per userId. A ban is not a Core role change and not an account delete.
 * `canInteract` reads bannedAt; a banned member cannot post, comment, challenge,
 * or send friend requests. Account hide sets hiddenAt and keeps rows (slice 10).
 * DB persistence lives in members-store.ts.
 */

import { isSocialBanned } from './interact'

export type MemberRecord = {
  userId: string
  bannedAt: Date | null
  /** Set when the account is hidden. Null = visible. Hide keeps all Social rows. */
  hiddenAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type MemberRefuseReason = 'invalid' | 'not_found' | 'cannot_manage' | 'not_banned'

/** True when a Social `hiddenAt` timestamp is set. */
export function isSocialAccountHidden(hiddenAt: Date | null | undefined): boolean {
  return hiddenAt != null
}

export type MemberMutationResult =
  | { ok: true; member: MemberRecord }
  | { ok: false; reason: MemberRefuseReason }

export type BanMemberInput = {
  actorUserId: string
  userId: string
}

export type UnbanMemberInput = {
  actorUserId: string
  userId: string
}

/**
 * Ban a member (set bannedAt). Requires social.reports manage (canManageReports).
 * Upserts the one row per userId.
 */
export function decideBanMember(
  current: MemberRecord | null,
  input: BanMemberInput,
  gates: { canManageReports: boolean },
  opts?: { now?: Date },
): MemberMutationResult {
  const actor = input.actorUserId.trim()
  const userId = input.userId.trim()
  if (!actor || !userId) return { ok: false, reason: 'invalid' }
  if (!gates.canManageReports) return { ok: false, reason: 'cannot_manage' }

  const now = opts?.now ?? new Date()
  if (current) {
    if (current.userId !== userId) return { ok: false, reason: 'invalid' }
    return {
      ok: true,
      member: {
        ...current,
        bannedAt: now,
        updatedAt: now,
      },
    }
  }

  return {
    ok: true,
    member: {
      userId,
      bannedAt: now,
      hiddenAt: null,
      createdAt: now,
      updatedAt: now,
    },
  }
}

/**
 * Clear bannedAt. Requires social.reports manage.
 * Refuses when there is no row or the member is not banned.
 */
export function decideUnbanMember(
  current: MemberRecord | null,
  input: UnbanMemberInput,
  gates: { canManageReports: boolean },
  opts?: { now?: Date },
): MemberMutationResult {
  const actor = input.actorUserId.trim()
  const userId = input.userId.trim()
  if (!actor || !userId) return { ok: false, reason: 'invalid' }
  if (!gates.canManageReports) return { ok: false, reason: 'cannot_manage' }
  if (!current || current.userId !== userId) return { ok: false, reason: 'not_found' }
  if (!isSocialBanned(current.bannedAt)) return { ok: false, reason: 'not_banned' }

  const now = opts?.now ?? new Date()
  return {
    ok: true,
    member: {
      ...current,
      bannedAt: null,
      updatedAt: now,
    },
  }
}

/** In-memory members with the same one-row-per-user rule as the DB path. */
export function createMemberMemory(opts?: { now?: () => Date }): {
  get: (userId: string) => MemberRecord | null
  ban: (
    input: BanMemberInput,
    gates: { canManageReports: boolean },
  ) => MemberMutationResult
  unban: (
    input: UnbanMemberInput,
    gates: { canManageReports: boolean },
  ) => MemberMutationResult
  /** Test helper — same field the account hide door sets. */
  setHiddenAt: (userId: string, hiddenAt: Date | null) => MemberRecord
} {
  const rows = new Map<string, MemberRecord>()
  const now = opts?.now ?? (() => new Date())

  return {
    get: (userId) => rows.get(userId.trim()) ?? null,
    ban: (input, gates) => {
      const current = rows.get(input.userId.trim()) ?? null
      const result = decideBanMember(current, input, gates, { now: now() })
      if (!result.ok) return result
      rows.set(result.member.userId, result.member)
      return result
    },
    unban: (input, gates) => {
      const current = rows.get(input.userId.trim()) ?? null
      const result = decideUnbanMember(current, input, gates, { now: now() })
      if (!result.ok) return result
      rows.set(result.member.userId, result.member)
      return result
    },
    setHiddenAt: (userId, hiddenAt) => {
      const id = userId.trim()
      const stamp = now()
      const current = rows.get(id)
      const next: MemberRecord = current
        ? { ...current, hiddenAt, updatedAt: stamp }
        : {
            userId: id,
            bannedAt: null,
            hiddenAt,
            createdAt: stamp,
            updatedAt: stamp,
          }
      rows.set(id, next)
      return next
    },
  }
}
