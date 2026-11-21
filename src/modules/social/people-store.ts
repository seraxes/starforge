/**
 * product:social People directory persistence — active profiles, omit blocked.
 */

import 'server-only'

import { and, eq, or } from 'drizzle-orm'

import { db } from '@/core/db'
import { listProfileDirectory } from '@/modules/profiles/api.server'

import { isBlockedBetween, isFriendshipStatus, type FriendshipRecord } from './friends'
import { listSocialHiddenUserIds } from './members-store'
import { isPeopleDirectoryCandidate } from './people'
import { sfSocialFriendships } from './schema'

export type PeopleDirectoryItem = {
  userId: string
  handle: string
  displayName: string
  avatarMediaId: string
}

function mapFriendshipRow(
  row: typeof sfSocialFriendships.$inferSelect,
): FriendshipRecord | null {
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

/** User ids on either side of a block with the viewer (either blocker column). */
export async function listBlockedPeerIds(viewerUserId: string): Promise<Set<string>> {
  const self = viewerUserId.trim()
  const out = new Set<string>()
  if (!self) return out
  try {
    const rows = await db
      .select()
      .from(sfSocialFriendships)
      .where(
        or(
          eq(sfSocialFriendships.requesterId, self),
          eq(sfSocialFriendships.addresseeId, self),
        ),
      )
    for (const raw of rows) {
      const row = mapFriendshipRow(raw)
      if (!isBlockedBetween(row)) continue
      const other = row!.requesterId === self ? row!.addresseeId : row!.requesterId
      if (other && other !== self) out.add(other)
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_friendships|does not exist|relation/i.test(msg)) return out
    throw error
  }
  return out
}

export type IncomingFriendRequestItem = {
  friendshipId: string
  requesterId: string
}

/** Pending requests addressed to the viewer (newest first). */
export async function listIncomingFriendRequests(
  viewerUserId: string,
): Promise<IncomingFriendRequestItem[]> {
  const self = viewerUserId.trim()
  if (!self) return []
  try {
    const rows = await db
      .select()
      .from(sfSocialFriendships)
      .where(
        and(
          eq(sfSocialFriendships.status, 'pending'),
          eq(sfSocialFriendships.addresseeId, self),
        ),
      )
    return rows
      .map((row) => ({ friendshipId: row.id, requesterId: row.requesterId }))
      .filter((row) => row.requesterId && row.requesterId !== self)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_friendships|does not exist|relation/i.test(msg)) return []
    throw error
  }
}

/**
 * People directory for a signed-in viewer.
 * Active profiles only; omits self, hidden, and blocked peers.
 */
export async function listPeopleDirectory(
  viewerUserId: string,
  options?: { q?: string; limit?: number },
): Promise<PeopleDirectoryItem[]> {
  const viewer = viewerUserId.trim()
  if (!viewer) return []

  const [directory, blockedIds, socialHidden] = await Promise.all([
    listProfileDirectory({
      q: options?.q,
      status: 'active',
      limit: options?.limit ?? 100,
    }),
    listBlockedPeerIds(viewer),
    listSocialHiddenUserIds(),
  ])

  const out: PeopleDirectoryItem[] = []
  for (const row of directory) {
    const userId = row.userId.trim()
    if (
      !isPeopleDirectoryCandidate(userId, viewer, {
        isHidden: row.status === 'hidden' || socialHidden.has(userId),
        isBlocked: blockedIds.has(userId),
      })
    ) {
      continue
    }
    out.push({
      userId,
      handle: row.handle,
      displayName: row.displayName || row.userName || userId,
      avatarMediaId: row.avatarMediaId,
    })
  }
  return out
}
