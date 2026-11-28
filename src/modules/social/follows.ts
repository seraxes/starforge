/**
 * product:social follows — directed edge (follower → followee).
 *
 * Unique one row per pair. A second follow updates that row. Create calls
 * canInteract — it does not re-derive the block rule. The Following tab lists
 * public posts from people the viewer follows (canViewPost still applies).
 */

import { canInteract, isSocialBanned, type CanInteractContext } from './interact'
import {
  canViewPost,
  type CanViewPostContext,
  type PostRecord,
} from './posts'
import { paginateFeedPosts } from './feed'
import { matchesFeedQuietExclusion } from './quiet'

export type FollowRecord = {
  id: string
  followerUserId: string
  followeeUserId: string
  createdAt: Date
  updatedAt: Date
}

export type FollowRefuseReason =
  | 'invalid'
  | 'self'
  | 'blocked'
  | 'cannot_interact'
  | 'banned'
  | 'not_following'
  /** Pack allowFollow is off. */
  | 'disabled'

export type FollowMutationResult =
  | { ok: true; follow: FollowRecord; write: 'insert' | 'update' }
  | { ok: false; reason: FollowRefuseReason }

export type UnfollowMutationResult =
  | { ok: true; removed: FollowRecord }
  | { ok: false; reason: FollowRefuseReason }

export type FollowInput = {
  followerUserId: string
  followeeUserId: string
  interact: CanInteractContext
}

export function followPairKey(
  followerUserId: string,
  followeeUserId: string,
): string {
  return `${followerUserId.trim()}\0${followeeUserId.trim()}`
}

/**
 * Follow another member. Unique (follower, followee): existing row updates.
 * Blocked / hidden / banned → refuse via canInteract.
 * Pack allowFollow off → disabled.
 */
export function decideFollow(
  current: FollowRecord | null,
  input: FollowInput,
  opts?: { now?: Date; newId?: () => string; allowFollow?: boolean },
): FollowMutationResult {
  const follower = input.followerUserId.trim()
  const followee = input.followeeUserId.trim()
  if (!follower || !followee) return { ok: false, reason: 'invalid' }
  if (follower === followee) return { ok: false, reason: 'self' }
  if (opts?.allowFollow === false) return { ok: false, reason: 'disabled' }

  if (
    isSocialBanned(input.interact.actorBannedAt) ||
    isSocialBanned(input.interact.otherBannedAt)
  ) {
    return { ok: false, reason: 'banned' }
  }
  if (!canInteract(follower, followee, input.interact)) {
    if (input.interact.isBlocked) return { ok: false, reason: 'blocked' }
    return { ok: false, reason: 'cannot_interact' }
  }

  const now = opts?.now ?? new Date()
  const newId = opts?.newId ?? (() => crypto.randomUUID())

  if (
    current &&
    current.followerUserId === follower &&
    current.followeeUserId === followee
  ) {
    return {
      ok: true,
      write: 'update',
      follow: { ...current, updatedAt: now },
    }
  }

  return {
    ok: true,
    write: 'insert',
    follow: {
      id: newId(),
      followerUserId: follower,
      followeeUserId: followee,
      createdAt: now,
      updatedAt: now,
    },
  }
}

export function decideUnfollow(
  current: FollowRecord | null,
  followerUserId: string,
  followeeUserId: string,
): UnfollowMutationResult {
  const follower = followerUserId.trim()
  const followee = followeeUserId.trim()
  if (!follower || !followee) return { ok: false, reason: 'invalid' }
  if (
    !current ||
    current.followerUserId !== follower ||
    current.followeeUserId !== followee
  ) {
    return { ok: false, reason: 'not_following' }
  }
  return { ok: true, removed: current }
}

/** Candidate for the Following tab: public personal post from a followee. */
export function isFollowingFeedCandidate(
  post: PostRecord,
  followeeIds: ReadonlySet<string>,
): boolean {
  if (post.pageId) return false
  if (post.audience !== 'public') return false
  return followeeIds.has(post.authorUserId)
}

/**
 * Following tab: public posts from followed authors the viewer may read.
 * Filter with canViewPost (block / hidden / staff-hide), then quiet cut, then paginate.
 */
export function selectFollowingFeedPage(
  postsNewestFirst: readonly PostRecord[],
  followeeIds: ReadonlySet<string>,
  ctxForPost: (post: PostRecord) => CanViewPostContext,
  limit: number,
  quiet?: {
    viewerUserId?: string | null
    hiddenPostIds?: ReadonlySet<string>
    mutedAuthorIds?: ReadonlySet<string>
  },
): PostRecord[] {
  const viewer = quiet?.viewerUserId ?? null
  const visible = postsNewestFirst.filter((post) => {
    if (!isFollowingFeedCandidate(post, followeeIds)) return false
    if (!canViewPost(post, ctxForPost(post))) return false
    if (
      matchesFeedQuietExclusion(post, viewer, {
        hiddenPostIds: quiet?.hiddenPostIds,
        mutedAuthorIds: quiet?.mutedAuthorIds,
      })
    ) {
      return false
    }
    return true
  })
  return paginateFeedPosts(visible, limit)
}

export type FollowBag = {
  follows: Map<string, FollowRecord>
}

export function applyFollow(
  bag: FollowBag,
  input: FollowInput,
  opts?: { now?: Date; newId?: () => string },
): FollowMutationResult {
  const key = followPairKey(input.followerUserId, input.followeeUserId)
  const current = bag.follows.get(key) ?? null
  const decision = decideFollow(current, input, opts)
  if (!decision.ok) return decision
  bag.follows.set(
    followPairKey(decision.follow.followerUserId, decision.follow.followeeUserId),
    decision.follow,
  )
  return decision
}

export function applyUnfollow(
  bag: FollowBag,
  followerUserId: string,
  followeeUserId: string,
): UnfollowMutationResult {
  const key = followPairKey(followerUserId, followeeUserId)
  const current = bag.follows.get(key) ?? null
  const decision = decideUnfollow(current, followerUserId, followeeUserId)
  if (!decision.ok) return decision
  bag.follows.delete(key)
  return decision
}

/** Followee user ids this follower follows. */
export function listFolloweeIdsFromBag(
  bag: FollowBag,
  followerUserId: string,
): string[] {
  const follower = followerUserId.trim()
  return [...bag.follows.values()]
    .filter((row) => row.followerUserId === follower)
    .map((row) => row.followeeUserId)
}

/** In-memory follows for unit tests — same unique pair rules as the DB. */
export function createFollowMemory(opts?: {
  now?: () => Date
  newId?: () => string
}): {
  bag: FollowBag
  follow: (input: FollowInput) => FollowMutationResult
  unfollow: (
    followerUserId: string,
    followeeUserId: string,
  ) => UnfollowMutationResult
  get: (followerUserId: string, followeeUserId: string) => FollowRecord | null
  listFolloweeIds: (followerUserId: string) => string[]
  followingFeed: (
    posts: readonly PostRecord[],
    followerUserId: string,
    ctxForPost: (post: PostRecord) => CanViewPostContext,
    limit?: number,
  ) => PostRecord[]
} {
  const bag: FollowBag = { follows: new Map() }
  const now = opts?.now ?? (() => new Date())
  const newId = opts?.newId ?? (() => crypto.randomUUID())

  return {
    bag,
    follow: (input) => applyFollow(bag, input, { now: now(), newId }),
    unfollow: (followerUserId, followeeUserId) =>
      applyUnfollow(bag, followerUserId, followeeUserId),
    get: (followerUserId, followeeUserId) =>
      bag.follows.get(followPairKey(followerUserId, followeeUserId)) ?? null,
    listFolloweeIds: (followerUserId) => listFolloweeIdsFromBag(bag, followerUserId),
    followingFeed: (posts, followerUserId, ctxForPost, limit = 50) => {
      const followeeIds = new Set(listFolloweeIdsFromBag(bag, followerUserId))
      return selectFollowingFeedPage(posts, followeeIds, ctxForPost, limit)
    },
  }
}
