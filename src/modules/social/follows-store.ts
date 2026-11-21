/**
 * product:social follows persistence (sf_social_follows + Following feed).
 *
 * Follow calls canInteract. Unique (follower, followee): concurrent second
 * insert updates the open row. Following tab lists public posts from followees.
 */

import 'server-only'

import { and, desc, eq, inArray, isNull, notInArray, sql } from 'drizzle-orm'

import { db } from '@/core/db'

import { areBlocked } from './friends-store'
import {
  decideFollow,
  decideUnfollow,
  type FollowInput,
  type FollowMutationResult,
  type FollowRecord,
  type UnfollowMutationResult,
} from './follows'
import { getMemberBannedAt, isMemberAccountHidden, listSocialHiddenUserIds } from './members-store'
import { listBlockedPeerIds } from './people-store'
import { toPostRecord, type PostRecord } from './posts'
import { hydratePostsMedia } from './posts-store'
import { sfSocialFollows, sfSocialPosts } from './schema'
import type { CanInteractContext } from './interact'

function mapFollow(row: typeof sfSocialFollows.$inferSelect): FollowRecord {
  return {
    id: row.id,
    followerUserId: row.followerUserId,
    followeeUserId: row.followeeUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function findFollow(
  followerUserId: string,
  followeeUserId: string,
): Promise<FollowRecord | null> {
  const follower = followerUserId.trim()
  const followee = followeeUserId.trim()
  if (!follower || !followee) return null
  try {
    const [row] = await db
      .select()
      .from(sfSocialFollows)
      .where(
        and(
          eq(sfSocialFollows.followerUserId, follower),
          eq(sfSocialFollows.followeeUserId, followee),
        ),
      )
      .limit(1)
    return row ? mapFollow(row) : null
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_follows|does not exist|relation/i.test(msg)) return null
    throw error
  }
}

/** User ids this follower follows. */
export async function listFolloweeIds(followerUserId: string): Promise<string[]> {
  const follower = followerUserId.trim()
  if (!follower) return []
  try {
    const rows = await db
      .select({ followeeUserId: sfSocialFollows.followeeUserId })
      .from(sfSocialFollows)
      .where(eq(sfSocialFollows.followerUserId, follower))
    return rows.map((row) => row.followeeUserId)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_follows|does not exist|relation/i.test(msg)) return []
    throw error
  }
}

async function interactAgainst(
  actorUserId: string,
  otherUserId: string,
): Promise<CanInteractContext> {
  const actor = actorUserId.trim()
  const other = otherUserId.trim()
  if (!actor || !other || actor === other) {
    return {
      isBlocked: false,
      actorHidden: false,
      otherHidden: false,
      actorBannedAt: null,
      otherBannedAt: null,
    }
  }
  const [blocked, actorHidden, otherHidden, actorBannedAt, otherBannedAt] =
    await Promise.all([
      areBlocked(actor, other),
      isMemberAccountHidden(actor),
      isMemberAccountHidden(other),
      getMemberBannedAt(actor),
      getMemberBannedAt(other),
    ])
  return {
    isBlocked: blocked,
    actorHidden,
    otherHidden,
    actorBannedAt,
    otherBannedAt,
  }
}

export async function followUser(
  input: Omit<FollowInput, 'interact'> & { interact?: CanInteractContext },
): Promise<FollowMutationResult> {
  const follower = input.followerUserId.trim()
  const followee = input.followeeUserId.trim()
  const current = await findFollow(follower, followee)
  const interact = input.interact ?? (await interactAgainst(follower, followee))
  const { loadSocialModuleSettings } = await import('./settings')
  const pack = await loadSocialModuleSettings()
  const decision = decideFollow(
    current,
    {
      followerUserId: follower,
      followeeUserId: followee,
      interact,
    },
    { allowFollow: pack.settings.allowFollow },
  )
  if (!decision.ok) return decision
  try {
    if (current) {
      await db
        .update(sfSocialFollows)
        .set({ updatedAt: decision.follow.updatedAt })
        .where(eq(sfSocialFollows.id, current.id))
    } else {
      await db.insert(sfSocialFollows).values({
        id: decision.follow.id,
        followerUserId: decision.follow.followerUserId,
        followeeUserId: decision.follow.followeeUserId,
        createdAt: decision.follow.createdAt,
        updatedAt: decision.follow.updatedAt,
      })
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/unique|duplicate/i.test(msg)) {
      const existing = await findFollow(follower, followee)
      if (existing) {
        await db
          .update(sfSocialFollows)
          .set({ updatedAt: decision.follow.updatedAt })
          .where(eq(sfSocialFollows.id, existing.id))
        return {
          ok: true,
          write: 'update',
          follow: { ...existing, updatedAt: decision.follow.updatedAt },
        }
      }
      return { ok: false, reason: 'invalid' }
    }
    if (/sf_social_follows|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'invalid' }
    }
    throw error
  }
  return decision
}

export async function unfollowUser(
  followerUserId: string,
  followeeUserId: string,
): Promise<UnfollowMutationResult> {
  const current = await findFollow(followerUserId, followeeUserId)
  const decision = decideUnfollow(current, followerUserId, followeeUserId)
  if (!decision.ok) return decision
  try {
    await db.delete(sfSocialFollows).where(eq(sfSocialFollows.id, decision.removed.id))
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_follows|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'invalid' }
    }
    throw error
  }
  return decision
}

/**
 * Following tab: public posts from people the viewer follows.
 * SQL filters audience + followees + block/hidden, then LIMIT (no short page).
 */
export async function listFollowingFeedPosts(
  viewerUserId: string,
  opts?: { limit?: number },
): Promise<PostRecord[]> {
  const viewer = viewerUserId.trim()
  if (!viewer) return []
  const limit = Math.min(Math.max(1, Math.floor(opts?.limit ?? 50)), 100)

  const [followeeIds, blockedPeerIds, hiddenAuthorIds] = await Promise.all([
    listFolloweeIds(viewer),
    listBlockedPeerIds(viewer),
    listSocialHiddenUserIds(),
  ])

  const visibleFollowees = followeeIds.filter(
    (id) => !blockedPeerIds.has(id) && !hiddenAuthorIds.has(id),
  )
  if (visibleFollowees.length === 0) return []

  const hiddenList = [...hiddenAuthorIds]
  const blockedList = [...blockedPeerIds]
  const authorNotBlocked =
    blockedList.length > 0
      ? notInArray(sfSocialPosts.authorUserId, blockedList)
      : sql`true`
  const authorNotHidden =
    hiddenList.length > 0
      ? notInArray(sfSocialPosts.authorUserId, hiddenList)
      : sql`true`

  let rows: (typeof sfSocialPosts.$inferSelect)[] = []
  try {
    rows = await db
      .select()
      .from(sfSocialPosts)
      .where(
        and(
          inArray(sfSocialPosts.authorUserId, visibleFollowees),
          eq(sfSocialPosts.audience, 'public'),
          isNull(sfSocialPosts.pageId),
          eq(sfSocialPosts.staffHidden, false),
          authorNotBlocked,
          authorNotHidden,
        ),
      )
      .orderBy(desc(sfSocialPosts.createdAt))
      .limit(limit)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_posts|sf_social_follows|does not exist|relation/i.test(msg)) {
      return []
    }
    throw error
  }

  const posts = rows
    .map((row) => toPostRecord(row))
    .filter((p): p is PostRecord => Boolean(p))
  return hydratePostsMedia(posts)
}
