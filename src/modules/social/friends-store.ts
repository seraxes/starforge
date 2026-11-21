/**
 * product:social friendship persistence (sf_social_friendships).
 * Unique on (pairLow, pairHigh). Request/block upsert; cancel/unfriend/unblock delete.
 * Blocked pairs use blockedBy + blockedByOther (slice 7 mutual block).
 */

import 'server-only'

import { and, count, eq } from 'drizzle-orm'

import { db } from '@/core/db'

import {
  areAcceptedFriends,
  decideFriendshipAction,
  friendshipPairKey,
  isBlockedBetween,
  isFriendshipStatus,
  requestFriendshipWithInteract,
  requestFriendshipWithMail,
  type FriendshipAction,
  type FriendshipMutationResult,
  type FriendshipRecord,
  type FriendshipStatus,
} from './friends'
import { emitFriendRequestedEmail } from './email'
import { getMemberBannedAt } from './members-store'
import { sfSocialFriendships } from './schema'

function mapRow(row: typeof sfSocialFriendships.$inferSelect): FriendshipRecord | null {
  if (!isFriendshipStatus(row.status)) return null
  return {
    id: row.id,
    requesterId: row.requesterId,
    addresseeId: row.addresseeId,
    pairLow: row.pairLow,
    pairHigh: row.pairHigh,
    status: row.status,
    blockedBy: row.blockedBy,
    blockedByOther: row.blockedByOther,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function findFriendship(
  userIdA: string,
  userIdB: string,
): Promise<FriendshipRecord | null> {
  const pair = friendshipPairKey(userIdA, userIdB)
  if (!pair) return null
  try {
    const rows = await db
      .select()
      .from(sfSocialFriendships)
      .where(
        and(
          eq(sfSocialFriendships.pairLow, pair.pairLow),
          eq(sfSocialFriendships.pairHigh, pair.pairHigh),
        ),
      )
      .limit(1)
    return rows[0] ? mapRow(rows[0]) : null
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_friendships|does not exist|relation/i.test(msg)) return null
    throw error
  }
}

export async function areFriends(userIdA: string, userIdB: string): Promise<boolean> {
  return areAcceptedFriends(await findFriendship(userIdA, userIdB))
}

/** Pair query: true while either blocker column (or blocked status) is set. */
export async function areBlocked(userIdA: string, userIdB: string): Promise<boolean> {
  return isBlockedBetween(await findFriendship(userIdA, userIdB))
}

async function upsertFriendshipRow(
  next: FriendshipRecord,
  setWhere?: ReturnType<typeof eq>,
): Promise<void> {
  const conflict = {
    target: [sfSocialFriendships.pairLow, sfSocialFriendships.pairHigh] as [
      typeof sfSocialFriendships.pairLow,
      typeof sfSocialFriendships.pairHigh,
    ],
    set: {
      requesterId: next.requesterId,
      addresseeId: next.addresseeId,
      status: next.status,
      blockedBy: next.blockedBy,
      blockedByOther: next.blockedByOther,
      updatedAt: next.updatedAt,
    },
    ...(setWhere ? { setWhere } : {}),
  }
  await db
    .insert(sfSocialFriendships)
    .values({
      id: next.id,
      requesterId: next.requesterId,
      addresseeId: next.addresseeId,
      pairLow: next.pairLow,
      pairHigh: next.pairHigh,
      status: next.status,
      blockedBy: next.blockedBy,
      blockedByOther: next.blockedByOther,
      createdAt: next.createdAt,
      updatedAt: next.updatedAt,
    })
    .onConflictDoUpdate(conflict)
}

async function mutateFriendship(action: FriendshipAction): Promise<FriendshipMutationResult> {
  const current = await findFriendship(action.actorId, action.otherId)
  const decision = decideFriendshipAction(current, action)
  if (!decision.ok) return { ok: false, reason: decision.reason }

  if (decision.write === 'noop') {
    return { ok: true, friendship: decision.friendship }
  }

  if (decision.write === 'delete') {
    const pair = friendshipPairKey(action.actorId, action.otherId)
    if (pair) {
      await db
        .delete(sfSocialFriendships)
        .where(
          and(
            eq(sfSocialFriendships.pairLow, pair.pairLow),
            eq(sfSocialFriendships.pairHigh, pair.pairHigh),
          ),
        )
    }
    return { ok: true, friendship: null }
  }

  const next = decision.friendship
  if (!next) return { ok: false, reason: 'invalid' }

  // Request / block: upsert on the unique pair. A second request updates a declined
  // row or is refused after re-read; block always overwrites the open row fields
  // without erasing the other blocker column (decision already merged both).
  if (action.type === 'request') {
    await upsertFriendshipRow(next, eq(sfSocialFriendships.status, 'declined'))
    const stored = await findFriendship(action.actorId, action.otherId)
    if (!stored) return { ok: false, reason: 'invalid' }
    if (isBlockedBetween(stored)) return { ok: false, reason: 'blocked' }
    if (stored.status === 'accepted') return { ok: false, reason: 'already_friends' }
    if (stored.status === 'pending' && stored.requesterId !== next.requesterId) {
      return { ok: false, reason: 'not_pending' }
    }
    if (stored.status !== 'pending') return { ok: false, reason: 'not_pending' }
    return { ok: true, friendship: stored }
  }

  if (action.type === 'block') {
    await upsertFriendshipRow(next)
    const stored = await findFriendship(action.actorId, action.otherId)
    return stored
      ? { ok: true, friendship: stored }
      : { ok: false, reason: 'invalid' }
  }

  await db
    .update(sfSocialFriendships)
    .set({
      requesterId: next.requesterId,
      addresseeId: next.addresseeId,
      status: next.status,
      blockedBy: next.blockedBy,
      blockedByOther: next.blockedByOther,
      updatedAt: next.updatedAt,
    })
    .where(
      and(
        eq(sfSocialFriendships.pairLow, next.pairLow),
        eq(sfSocialFriendships.pairHigh, next.pairHigh),
      ),
    )
  return { ok: true, friendship: next }
}

/** Outgoing pending friend requests for this requester. */
export async function countPendingOutgoingFriendRequests(
  requesterId: string,
): Promise<number> {
  const id = requesterId.trim()
  if (!id) return 0
  try {
    const rows = await db
      .select({ value: count() })
      .from(sfSocialFriendships)
      .where(
        and(
          eq(sfSocialFriendships.requesterId, id),
          eq(sfSocialFriendships.status, 'pending'),
        ),
      )
    return Number(rows[0]?.value ?? 0)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_friendships|does not exist|relation/i.test(msg)) return 0
    throw error
  }
}

export async function requestFriendship(
  actorId: string,
  otherId: string,
): Promise<FriendshipMutationResult> {
  const actor = actorId.trim()
  const other = otherId.trim()
  const current = await findFriendship(actor, other)
  const [actorBannedAt, otherBannedAt, pack, pendingOutgoingCount] = await Promise.all([
    getMemberBannedAt(actor),
    getMemberBannedAt(other),
    import('./settings').then((m) => m.loadSocialModuleSettings()),
    countPendingOutgoingFriendRequests(actor),
  ])
  // Re-requesting the same pending pair does not count against the cap again.
  const pendingForCap =
    current?.status === 'pending' && current.requesterId === actor
      ? Math.max(0, pendingOutgoingCount - 1)
      : pendingOutgoingCount
  const gated = requestFriendshipWithInteract(
    current,
    actor,
    other,
    {
      isBlocked: isBlockedBetween(current),
      actorHidden: false,
      otherHidden: false,
      actorBannedAt,
      otherBannedAt,
    },
    {
      allowFriendRequests: pack.settings.allowFriendRequests,
      pendingOutgoingCount: pendingForCap,
      maxPendingFriendRequests: pack.settings.maxPendingFriendRequests,
    },
  )
  if (!gated.ok) return gated
  // Persist through the same mutate path (unique pair upsert).
  return mutateFriendship({ type: 'request', actorId: actor, otherId: other })
}

/**
 * Request a friendship and emit `product:social/friend.requested`.
 * Mail failure does not roll back the request row.
 */
export async function requestFriendshipNotifying(
  actorId: string,
  otherId: string,
): Promise<FriendshipMutationResult> {
  return requestFriendshipWithMail(
    () => requestFriendship(actorId, otherId),
    (friendship) =>
      emitFriendRequestedEmail({
        requesterId: friendship.requesterId,
        addresseeId: friendship.addresseeId,
        friendshipId: friendship.id,
      }),
  )
}

export async function acceptFriendship(
  actorId: string,
  otherId: string,
): Promise<FriendshipMutationResult> {
  return mutateFriendship({ type: 'accept', actorId, otherId })
}

export async function declineFriendship(
  actorId: string,
  otherId: string,
): Promise<FriendshipMutationResult> {
  return mutateFriendship({ type: 'decline', actorId, otherId })
}

export async function cancelFriendship(
  actorId: string,
  otherId: string,
): Promise<FriendshipMutationResult> {
  return mutateFriendship({ type: 'cancel', actorId, otherId })
}

export async function unfriend(
  actorId: string,
  otherId: string,
): Promise<FriendshipMutationResult> {
  return mutateFriendship({ type: 'unfriend', actorId, otherId })
}

export async function blockUser(
  actorId: string,
  otherId: string,
): Promise<FriendshipMutationResult> {
  return mutateFriendship({ type: 'block', actorId, otherId })
}

/** Clear only this actor’s blocker column; refuses if they are not a recorded blocker. */
export async function unblockUser(
  actorId: string,
  otherId: string,
): Promise<FriendshipMutationResult> {
  return mutateFriendship({ type: 'unblock', actorId, otherId })
}

export type { FriendshipRecord, FriendshipStatus, FriendshipMutationResult }
