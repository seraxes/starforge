/**
 * product:social friendship graph — pure decision + in-memory store.
 *
 * One row per unordered pair. A second insert updates a declined row or is refused
 * (blocked / already friends). Cancel and unfriend delete the row.
 * Block records each side in blockedBy / blockedByOther; only a recorded blocker
 * can clear their own side. Visibility stays blocked while either column is set.
 * Friend request also refuses when canInteract fails (Social bannedAt).
 * DB persistence lives in friends-store.ts and uses the same decide path.
 */

import { canInteract, isSocialBanned, type CanInteractContext } from './interact'

export const FRIENDSHIP_STATUSES = ['pending', 'accepted', 'declined', 'blocked'] as const
export type FriendshipStatus = (typeof FRIENDSHIP_STATUSES)[number]

export type FriendshipRecord = {
  id: string
  requesterId: string
  addresseeId: string
  pairLow: string
  pairHigh: string
  status: FriendshipStatus
  blockedBy: string | null
  /** Second blocker — mutual block without erasing the first. */
  blockedByOther: string | null
  createdAt: Date
  updatedAt: Date
}

export type FriendshipRefuseReason =
  | 'invalid'
  | 'self'
  | 'not_found'
  | 'not_pending'
  | 'not_addressee'
  | 'not_requester'
  | 'already_accepted'
  | 'already_friends'
  | 'blocked'
  | 'not_friends'
  | 'not_blocker'
  | 'banned'
  /** Pack allowFriendRequests is off. */
  | 'disabled'
  /** Actor already has maxPendingFriendRequests open outgoing requests. */
  | 'pending_cap'

export type FriendshipMutationResult =
  | { ok: true; friendship: FriendshipRecord | null }
  | { ok: false; reason: FriendshipRefuseReason }

export type FriendshipAction =
  | { type: 'request'; actorId: string; otherId: string }
  | { type: 'accept'; actorId: string; otherId: string }
  | { type: 'decline'; actorId: string; otherId: string }
  | { type: 'cancel'; actorId: string; otherId: string }
  | { type: 'unfriend'; actorId: string; otherId: string }
  | { type: 'block'; actorId: string; otherId: string }
  | { type: 'unblock'; actorId: string; otherId: string }

export type FriendshipDecision =
  | {
      ok: true
      write: 'insert' | 'update' | 'delete' | 'noop'
      friendship: FriendshipRecord | null
    }
  | { ok: false; reason: FriendshipRefuseReason }

export function isFriendshipStatus(value: string): value is FriendshipStatus {
  return (FRIENDSHIP_STATUSES as readonly string[]).includes(value)
}

/** Lexicographic unordered pair key — backs the unique index. */
export function friendshipPairKey(
  userIdA: string,
  userIdB: string,
): { pairLow: string; pairHigh: string } | null {
  const a = userIdA.trim()
  const b = userIdB.trim()
  if (!a || !b || a === b) return null
  return a < b ? { pairLow: a, pairHigh: b } : { pairLow: b, pairHigh: a }
}

export function pairMapKey(pairLow: string, pairHigh: string): string {
  return `${pairLow}\0${pairHigh}`
}

export function areAcceptedFriends(row: FriendshipRecord | null | undefined): boolean {
  return row?.status === 'accepted'
}

/** True while either blocker column is set (pair query / canViewPost / canInteract). */
export function isBlockedBetween(row: FriendshipRecord | null | undefined): boolean {
  if (!row) return false
  return Boolean(row.blockedBy || row.blockedByOther) || row.status === 'blocked'
}

/** Whether this user id is recorded as a blocker on the row. */
export function isRecordedBlocker(
  row: FriendshipRecord | null | undefined,
  userId: string,
): boolean {
  const id = userId.trim()
  if (!row || !id) return false
  return row.blockedBy === id || row.blockedByOther === id
}

function clearBlockers(): { blockedBy: null; blockedByOther: null } {
  return { blockedBy: null, blockedByOther: null }
}

function withActorBlocker(row: FriendshipRecord, actorId: string, now: Date): FriendshipRecord {
  if (row.blockedBy === actorId || row.blockedByOther === actorId) {
    return { ...row, status: 'blocked', updatedAt: now }
  }
  if (!row.blockedBy) {
    return {
      ...row,
      status: 'blocked',
      blockedBy: actorId,
      updatedAt: now,
    }
  }
  if (!row.blockedByOther) {
    return {
      ...row,
      status: 'blocked',
      blockedByOther: actorId,
      updatedAt: now,
    }
  }
  return { ...row, status: 'blocked', updatedAt: now }
}

function trimPair(
  actorId: string,
  otherId: string,
): { actorId: string; otherId: string; pairLow: string; pairHigh: string } | null {
  const actor = actorId.trim()
  const other = otherId.trim()
  const pair = friendshipPairKey(actor, other)
  if (!pair) return null
  return { actorId: actor, otherId: other, ...pair }
}

/**
 * Decide the next friendship row for an action.
 * Callers persist with insert / update / delete — they do not invent a second pair row.
 */
export function decideFriendshipAction(
  current: FriendshipRecord | null,
  action: FriendshipAction,
  opts?: { now?: Date; newId?: () => string },
): FriendshipDecision {
  const now = opts?.now ?? new Date()
  const newId = opts?.newId ?? (() => crypto.randomUUID())

  const ids = trimPair(action.actorId, action.otherId)
  if (!ids) {
    const a = action.actorId.trim()
    const b = action.otherId.trim()
    if (a && b && a === b) return { ok: false, reason: 'self' }
    return { ok: false, reason: 'invalid' }
  }
  const { actorId, otherId, pairLow, pairHigh } = ids

  if (current && (current.pairLow !== pairLow || current.pairHigh !== pairHigh)) {
    return { ok: false, reason: 'invalid' }
  }

  switch (action.type) {
    case 'request': {
      if (isBlockedBetween(current)) return { ok: false, reason: 'blocked' }
      if (current?.status === 'accepted') return { ok: false, reason: 'already_friends' }
      if (current?.status === 'pending') {
        if (current.requesterId === actorId) {
          return { ok: true, write: 'noop', friendship: current }
        }
        return { ok: false, reason: 'not_pending' }
      }
      if (current?.status === 'declined') {
        const next: FriendshipRecord = {
          ...current,
          requesterId: actorId,
          addresseeId: otherId,
          status: 'pending',
          ...clearBlockers(),
          updatedAt: now,
        }
        return { ok: true, write: 'update', friendship: next }
      }
      const next: FriendshipRecord = {
        id: newId(),
        requesterId: actorId,
        addresseeId: otherId,
        pairLow,
        pairHigh,
        status: 'pending',
        ...clearBlockers(),
        createdAt: now,
        updatedAt: now,
      }
      return { ok: true, write: 'insert', friendship: next }
    }
    case 'accept': {
      if (!current) return { ok: false, reason: 'not_found' }
      if (isBlockedBetween(current)) return { ok: false, reason: 'blocked' }
      if (current.status === 'accepted') return { ok: false, reason: 'already_accepted' }
      if (current.status !== 'pending') return { ok: false, reason: 'not_pending' }
      if (current.addresseeId !== actorId || current.requesterId !== otherId) {
        return { ok: false, reason: 'not_addressee' }
      }
      return {
        ok: true,
        write: 'update',
        friendship: {
          ...current,
          status: 'accepted',
          ...clearBlockers(),
          updatedAt: now,
        },
      }
    }
    case 'decline': {
      if (!current) return { ok: false, reason: 'not_found' }
      if (isBlockedBetween(current)) return { ok: false, reason: 'blocked' }
      if (current.status !== 'pending') return { ok: false, reason: 'not_pending' }
      if (current.addresseeId !== actorId || current.requesterId !== otherId) {
        return { ok: false, reason: 'not_addressee' }
      }
      return {
        ok: true,
        write: 'update',
        friendship: {
          ...current,
          status: 'declined',
          ...clearBlockers(),
          updatedAt: now,
        },
      }
    }
    case 'cancel': {
      if (!current) return { ok: false, reason: 'not_found' }
      if (isBlockedBetween(current)) return { ok: false, reason: 'blocked' }
      if (current.status !== 'pending') return { ok: false, reason: 'not_pending' }
      if (current.requesterId !== actorId || current.addresseeId !== otherId) {
        return { ok: false, reason: 'not_requester' }
      }
      return { ok: true, write: 'delete', friendship: null }
    }
    case 'unfriend': {
      if (!current) return { ok: false, reason: 'not_found' }
      if (isBlockedBetween(current)) return { ok: false, reason: 'blocked' }
      if (current.status !== 'accepted') return { ok: false, reason: 'not_friends' }
      return { ok: true, write: 'delete', friendship: null }
    }
    case 'block': {
      if (current && isRecordedBlocker(current, actorId)) {
        return { ok: true, write: 'noop', friendship: current }
      }
      if (current) {
        const next = withActorBlocker(
          {
            ...current,
            requesterId: actorId,
            addresseeId: otherId,
          },
          actorId,
          now,
        )
        return { ok: true, write: 'update', friendship: next }
      }
      return {
        ok: true,
        write: 'insert',
        friendship: {
          id: newId(),
          requesterId: actorId,
          addresseeId: otherId,
          pairLow,
          pairHigh,
          status: 'blocked',
          blockedBy: actorId,
          blockedByOther: null,
          createdAt: now,
          updatedAt: now,
        },
      }
    }
    case 'unblock': {
      if (!current) return { ok: false, reason: 'not_found' }
      if (!isRecordedBlocker(current, actorId)) {
        return { ok: false, reason: 'not_blocker' }
      }
      const blockedBy = current.blockedBy === actorId ? null : current.blockedBy
      const blockedByOther =
        current.blockedByOther === actorId ? null : current.blockedByOther
      if (!blockedBy && !blockedByOther) {
        return { ok: true, write: 'delete', friendship: null }
      }
      return {
        ok: true,
        write: 'update',
        friendship: {
          ...current,
          status: 'blocked',
          blockedBy,
          blockedByOther,
          updatedAt: now,
        },
      }
    }
  }
}

/**
 * Friend request after canInteract (ban / hidden / block facts).
 * Named ban refuse when either side has a Social bannedAt.
 * Pack: allowFriendRequests off → disabled; pending cap → pending_cap.
 */
export function requestFriendshipWithInteract(
  current: FriendshipRecord | null,
  actorId: string,
  otherId: string,
  interactCtx: CanInteractContext,
  opts?: {
    now?: Date
    newId?: () => string
    allowFriendRequests?: boolean
    /** Outgoing pending requests for the actor (not counting this pair). */
    pendingOutgoingCount?: number
    maxPendingFriendRequests?: number
  },
): FriendshipMutationResult {
  if (opts?.allowFriendRequests === false) {
    return { ok: false, reason: 'disabled' }
  }
  const maxPending = opts?.maxPendingFriendRequests
  if (
    typeof maxPending === 'number' &&
    Number.isInteger(maxPending) &&
    maxPending > 0 &&
    typeof opts?.pendingOutgoingCount === 'number' &&
    opts.pendingOutgoingCount >= maxPending
  ) {
    return { ok: false, reason: 'pending_cap' }
  }
  if (
    isSocialBanned(interactCtx.actorBannedAt) ||
    isSocialBanned(interactCtx.otherBannedAt)
  ) {
    return { ok: false, reason: 'banned' }
  }
  if (!canInteract(actorId, otherId, interactCtx)) {
    if (interactCtx.isBlocked) return { ok: false, reason: 'blocked' }
    return { ok: false, reason: 'banned' }
  }
  const decision = decideFriendshipAction(
    current,
    { type: 'request', actorId, otherId },
    opts,
  )
  if (!decision.ok) return { ok: false, reason: decision.reason }
  return { ok: true, friendship: decision.friendship }
}

/**
 * Persist a friend request, then emit mail. Mail failure must not roll back.
 * Callers inject decide/persist and emit so unit tests can throw from emit.
 */
export async function requestFriendshipWithMail(
  persistRequest: () => FriendshipMutationResult | Promise<FriendshipMutationResult>,
  emitMail: (friendship: FriendshipRecord) => void | Promise<void>,
): Promise<FriendshipMutationResult> {
  const result = await persistRequest()
  if (!result.ok || !result.friendship) return result
  try {
    await emitMail(result.friendship)
  } catch {
    // Soft-fail — the request row must stay.
  }
  return result
}

/** In-memory graph with the same unique-pair rule as the DB table. */
export function createFriendshipMemory(opts?: {
  newId?: () => string
  now?: () => Date
}): {
  get: (userIdA: string, userIdB: string) => FriendshipRecord | null
  request: (actorId: string, otherId: string) => FriendshipMutationResult
  accept: (actorId: string, otherId: string) => FriendshipMutationResult
  decline: (actorId: string, otherId: string) => FriendshipMutationResult
  cancel: (actorId: string, otherId: string) => FriendshipMutationResult
  unfriend: (actorId: string, otherId: string) => FriendshipMutationResult
  block: (actorId: string, otherId: string) => FriendshipMutationResult
  unblock: (actorId: string, otherId: string) => FriendshipMutationResult
} {
  const rows = new Map<string, FriendshipRecord>()
  const newId = opts?.newId ?? (() => crypto.randomUUID())
  const now = opts?.now ?? (() => new Date())

  function get(userIdA: string, userIdB: string): FriendshipRecord | null {
    const pair = friendshipPairKey(userIdA, userIdB)
    if (!pair) return null
    return rows.get(pairMapKey(pair.pairLow, pair.pairHigh)) ?? null
  }

  function apply(action: FriendshipAction): FriendshipMutationResult {
    const pair = friendshipPairKey(action.actorId, action.otherId)
    const current = pair ? (rows.get(pairMapKey(pair.pairLow, pair.pairHigh)) ?? null) : null
    const decision = decideFriendshipAction(current, action, { now: now(), newId })
    if (!decision.ok) return { ok: false, reason: decision.reason }
    if (decision.write === 'delete' && pair) {
      rows.delete(pairMapKey(pair.pairLow, pair.pairHigh))
    } else if (
      (decision.write === 'insert' || decision.write === 'update') &&
      decision.friendship
    ) {
      rows.set(
        pairMapKey(decision.friendship.pairLow, decision.friendship.pairHigh),
        decision.friendship,
      )
    }
    return { ok: true, friendship: decision.friendship }
  }

  return {
    get,
    request: (actorId, otherId) => apply({ type: 'request', actorId, otherId }),
    accept: (actorId, otherId) => apply({ type: 'accept', actorId, otherId }),
    decline: (actorId, otherId) => apply({ type: 'decline', actorId, otherId }),
    cancel: (actorId, otherId) => apply({ type: 'cancel', actorId, otherId }),
    unfriend: (actorId, otherId) => apply({ type: 'unfriend', actorId, otherId }),
    block: (actorId, otherId) => apply({ type: 'block', actorId, otherId }),
    unblock: (actorId, otherId) => apply({ type: 'unblock', actorId, otherId }),
  }
}
