/**
 * product:social People directory persistence — active profiles, omit blocked.
 * Suggestions rank by mutual accepted friends (not a second friend graph).
 */

import 'server-only'

import { and, eq, or } from 'drizzle-orm'

import { db } from '@/core/db'
import { listProfileDirectory } from '@/modules/profiles/api.server'

import { isBlockedBetween, isFriendshipStatus, type FriendshipRecord } from './friends'
import {
  listSocialBannedUserIds,
  listSocialHiddenUserIds,
} from './members-store'
import {
  PEOPLE_SUGGESTION_LIMIT_DEFAULT,
  countMutualFriends,
  isPeopleDirectoryCandidate,
  selectPeopleSuggestions,
  type PeopleSuggestionCandidate,
} from './people'
import { sfSocialFriendships } from './schema'

export type PeopleDirectoryItem = {
  userId: string
  handle: string
  displayName: string
  avatarMediaId: string
}

export type PeopleSuggestionItem = PeopleDirectoryItem & {
  mutualFriendCount: number
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

function otherFriendshipUserId(
  row: typeof sfSocialFriendships.$inferSelect,
  selfId: string,
): string {
  return row.requesterId === selfId ? row.addresseeId : row.requesterId
}

/** Accepted friend user ids (local copy — avoid importing feed-store). */
async function listAcceptedFriendIdsLocal(userId: string): Promise<string[]> {
  const self = userId.trim()
  if (!self) return []
  try {
    const rows = await db
      .select()
      .from(sfSocialFriendships)
      .where(
        and(
          eq(sfSocialFriendships.status, 'accepted'),
          or(
            eq(sfSocialFriendships.requesterId, self),
            eq(sfSocialFriendships.addresseeId, self),
          ),
        ),
      )
    return rows.map((row) => otherFriendshipUserId(row, self)).filter(Boolean)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_friendships|does not exist|relation/i.test(msg)) return []
    throw error
  }
}

/** Shared accepted-friend count between two members. */
export async function countMutualFriendsBetween(
  viewerUserId: string,
  otherUserId: string,
): Promise<number> {
  const viewer = viewerUserId.trim()
  const other = otherUserId.trim()
  if (!viewer || !other || viewer === other) return 0
  const [viewerFriends, otherFriends] = await Promise.all([
    listAcceptedFriendIdsLocal(viewer),
    listAcceptedFriendIdsLocal(other),
  ])
  return countMutualFriends(new Set(viewerFriends), new Set(otherFriends))
}

/**
 * Short People suggestions for a signed-in viewer.
 * Reuses the friendship graph; prefers highest mutual accepted-friend counts.
 * Returns [] when nobody shares a mutual friend (does not fall back to the directory).
 */
export async function listPeopleSuggestions(
  viewerUserId: string,
  options?: { limit?: number },
): Promise<PeopleSuggestionItem[]> {
  const viewer = viewerUserId.trim()
  if (!viewer) return []
  const limit = options?.limit ?? PEOPLE_SUGGESTION_LIMIT_DEFAULT

  const [directory, blockedIds, socialHidden, bannedIds, viewerFriendIds] =
    await Promise.all([
      listProfileDirectory({ status: 'active', limit: 100 }),
      listBlockedPeerIds(viewer),
      listSocialHiddenUserIds(),
      listSocialBannedUserIds(),
      listAcceptedFriendIdsLocal(viewer),
    ])

  const viewerFriendSet = new Set(viewerFriendIds)
  if (viewerFriendSet.size === 0) return []

  const directoryById = new Map<string, PeopleDirectoryItem>()
  const ranked: PeopleSuggestionCandidate[] = []

  for (const row of directory) {
    const userId = row.userId.trim()
    if (!userId) continue
    const item: PeopleDirectoryItem = {
      userId,
      handle: row.handle,
      displayName: row.displayName || row.userName || userId,
      avatarMediaId: row.avatarMediaId,
    }
    directoryById.set(userId, item)
    ranked.push({
      userId,
      isHidden: row.status === 'hidden' || socialHidden.has(userId),
      isBlocked: blockedIds.has(userId),
      isFriend: viewerFriendSet.has(userId),
      isBanned: bannedIds.has(userId),
      mutualFriendCount: 0,
    })
  }

  const friendOfFriendCounts = new Map<string, number>()
  const secondDegree = await Promise.all(
    [...viewerFriendSet].map(async (friendId) => {
      const peers = await listAcceptedFriendIdsLocal(friendId)
      return peers
    }),
  )
  for (const peers of secondDegree) {
    for (const peerId of peers) {
      if (!peerId || peerId === viewer) continue
      friendOfFriendCounts.set(peerId, (friendOfFriendCounts.get(peerId) ?? 0) + 1)
    }
  }

  for (const row of ranked) {
    row.mutualFriendCount = friendOfFriendCounts.get(row.userId) ?? 0
  }

  const selected = selectPeopleSuggestions(ranked, viewer, { limit })
  const out: PeopleSuggestionItem[] = []
  for (const row of selected) {
    const item = directoryById.get(row.userId)
    if (!item) continue
    out.push({ ...item, mutualFriendCount: row.mutualFriendCount })
  }
  return out
}
