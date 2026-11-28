/**
 * product:social polls + check-in persistence.
 *
 * Poll votes: unique (postId, userId) — concurrent second insert updates optionId.
 * Check-in: Maps door (MapProvider geocode) failure still saves the place label.
 */

import 'server-only'

import { and, eq, sql } from 'drizzle-orm'

import { db } from '@/core/db'
import { getMapProvider } from '@/core/maps'

import { areBlocked } from './friends-store'
import type { CanInteractContext } from './interact'
import { getMemberBannedAt, isMemberAccountHidden } from './members-store'
import {
  decideClosePoll,
  decideCreateCheckinPost,
  decideCreatePollPost,
  decideEditPollPost,
  decideVotePoll,
  type ClosePollInput,
  type CreateCheckinPostInput,
  type CreatePollPostInput,
  type EditPollPostInput,
  type MapsPinResolveResult,
  type PollCheckinMutationResult,
  type PollVoteMutationResult,
  type PollVoteRecord,
  type VotePollInput,
} from './polls-checkin'
import { canViewerSeePost, findPost } from './posts-store'
import { sfSocialPollVotes, sfSocialPosts } from './schema'
import type { PostRecord } from './posts'

function mapVote(row: typeof sfSocialPollVotes.$inferSelect): PollVoteRecord {
  return {
    id: row.id,
    postId: row.postId,
    userId: row.userId,
    optionId: row.optionId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

async function insertPostRow(post: PostRecord): Promise<void> {
  await db.insert(sfSocialPosts).values({
    id: post.id,
    authorUserId: post.authorUserId,
    body: post.body,
    kind: post.kind,
    audience: post.audience,
    groupId: post.groupId,
    pageId: post.pageId,
    sharedPostId: post.sharedPostId,
    linkUrl: post.linkUrl,
    linkTitle: post.linkTitle,
    linkDescription: post.linkDescription,
    linkImageUrl: post.linkImageUrl,
    pollOptions: post.pollOptions,
    pollClosedAt: post.pollClosedAt,
    placeLabel: post.placeLabel,
    mapsPinId: post.mapsPinId,
    placeLat: post.placeLat,
    placeLng: post.placeLng,
    staffHidden: post.staffHidden,
    pendingReview: post.pendingReview,
    isAnnouncement: post.isAnnouncement,
    editedAt: post.editedAt,
    extensions: post.extensions,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  })
}

async function updatePostPollFields(post: PostRecord): Promise<void> {
  await db
    .update(sfSocialPosts)
    .set({
      body: post.body,
      pollOptions: post.pollOptions,
      pollClosedAt: post.pollClosedAt,
      editedAt: post.editedAt,
      updatedAt: post.updatedAt,
    })
    .where(eq(sfSocialPosts.id, post.id))
}

/**
 * Maps door for check-in: geocode the label via MapProvider.
 * Failure / missing geocode → null (caller still saves the label).
 */
export async function resolveMapsCheckInPin(
  label: string,
): Promise<MapsPinResolveResult | null> {
  const query = label.trim()
  if (!query) return null
  try {
    const provider = await getMapProvider()
    if (!provider.geocode) return null
    const point = await provider.geocode(query)
    if (!point) return null
    return {
      pinId: `geo:${point.lat},${point.lng}`,
      lat: point.lat,
      lng: point.lng,
    }
  } catch {
    return null
  }
}

export async function findPollVote(
  postId: string,
  userId: string,
): Promise<PollVoteRecord | null> {
  const pid = postId.trim()
  const uid = userId.trim()
  if (!pid || !uid) return null
  try {
    const [row] = await db
      .select()
      .from(sfSocialPollVotes)
      .where(
        and(eq(sfSocialPollVotes.postId, pid), eq(sfSocialPollVotes.userId, uid)),
      )
      .limit(1)
    return row ? mapVote(row) : null
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_poll_votes|does not exist|relation/i.test(msg)) return null
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

export async function createPollPost(
  input: Omit<CreatePollPostInput, 'actorBannedAt'> & {
    actorBannedAt?: Date | null
  },
): Promise<PollCheckinMutationResult> {
  const authorUserId = input.authorUserId.trim()
  const actorBannedAt =
    input.actorBannedAt !== undefined
      ? input.actorBannedAt
      : authorUserId
        ? await getMemberBannedAt(authorUserId)
        : null
  const { loadSocialModuleSettings } = await import('./settings')
  const { isComposerPostKindEnabled } = await import('./pack-settings')
  const pack = await loadSocialModuleSettings()
  const decided = decideCreatePollPost(
    { ...input, actorBannedAt },
    {
      kindEnabled: isComposerPostKindEnabled('poll', pack.settings),
      holdForStaffReview: pack.settings.holdNewPostsForReview,
    },
  )
  if (!decided.ok) return decided
  try {
    await insertPostRow(decided.post)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_posts|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'invalid' }
    }
    throw error
  }
  const stored = await findPost(decided.post.id)
  return stored ? { ok: true, post: stored } : decided
}

export async function editPollPost(
  input: EditPollPostInput,
): Promise<PollCheckinMutationResult> {
  const current = await findPost(input.postId)
  const decided = decideEditPollPost(current, input)
  if (!decided.ok) return decided
  try {
    await updatePostPollFields(decided.post)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_posts|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'invalid' }
    }
    throw error
  }
  const stored = await findPost(decided.post.id)
  return stored ? { ok: true, post: stored } : decided
}

export async function closePoll(
  input: ClosePollInput,
): Promise<PollCheckinMutationResult> {
  const current = await findPost(input.postId)
  const decided = decideClosePoll(current, input)
  if (!decided.ok) return decided
  try {
    await updatePostPollFields(decided.post)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_posts|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'invalid' }
    }
    throw error
  }
  const stored = await findPost(decided.post.id)
  return stored ? { ok: true, post: stored } : decided
}

export async function votePoll(
  input: Omit<VotePollInput, 'interact' | 'canView' | 'actorBannedAt'> & {
    interact?: CanInteractContext
    canView?: boolean
    actorBannedAt?: Date | null
  },
): Promise<PollVoteMutationResult> {
  const userId = input.userId.trim()
  const postId = input.postId.trim()
  const post = await findPost(postId)
  if (!post) return { ok: false, reason: 'not_found' }

  const [current, interact, canView, actorBannedAt] = await Promise.all([
    findPollVote(postId, userId),
    input.interact
      ? Promise.resolve(input.interact)
      : interactAgainst(userId, post.authorUserId),
    input.canView !== undefined
      ? Promise.resolve(input.canView)
      : canViewerSeePost(userId, post),
    input.actorBannedAt !== undefined
      ? Promise.resolve(input.actorBannedAt)
      : getMemberBannedAt(userId),
  ])

  const decided = decideVotePoll(post, current, {
    userId,
    postId,
    optionId: input.optionId,
    interact,
    canView,
    actorBannedAt,
  })
  if (!decided.ok) return decided

  const vote = decided.vote
  try {
    if (decided.write === 'update' && current) {
      await db
        .update(sfSocialPollVotes)
        .set({ optionId: vote.optionId, updatedAt: vote.updatedAt })
        .where(eq(sfSocialPollVotes.id, current.id))
    } else {
      try {
        await db.insert(sfSocialPollVotes).values({
          id: vote.id,
          postId: vote.postId,
          userId: vote.userId,
          optionId: vote.optionId,
          createdAt: vote.createdAt,
          updatedAt: vote.updatedAt,
        })
      } catch (error) {
        // Unique (postId, userId): concurrent second insert → update open row.
        const msg = error instanceof Error ? error.message : String(error)
        if (!/unique|duplicate/i.test(msg)) throw error
        const existing = await findPollVote(vote.postId, vote.userId)
        if (!existing) throw error
        await db
          .update(sfSocialPollVotes)
          .set({ optionId: vote.optionId, updatedAt: vote.updatedAt })
          .where(eq(sfSocialPollVotes.id, existing.id))
        return {
          ok: true,
          write: 'update',
          vote: { ...existing, optionId: vote.optionId, updatedAt: vote.updatedAt },
        }
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_poll_votes|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'invalid' }
    }
    throw error
  }

  return decided
}

export async function createCheckinPost(
  input: Omit<CreateCheckinPostInput, 'resolveMapsPin' | 'actorBannedAt'> & {
    actorBannedAt?: Date | null
    /** Injected for tests; default uses Maps / MapProvider geocode. */
    resolveMapsPin?: CreateCheckinPostInput['resolveMapsPin']
  },
): Promise<PollCheckinMutationResult> {
  const authorUserId = input.authorUserId.trim()
  const actorBannedAt =
    input.actorBannedAt !== undefined
      ? input.actorBannedAt
      : authorUserId
        ? await getMemberBannedAt(authorUserId)
        : null

  let resolveMapsPin = input.resolveMapsPin
  if (!resolveMapsPin) {
    const pin = await resolveMapsCheckInPin(input.placeLabel)
    resolveMapsPin = () => pin
  }

  const { loadSocialModuleSettings } = await import('./settings')
  const { isComposerPostKindEnabled } = await import('./pack-settings')
  const pack = await loadSocialModuleSettings()
  const decided = decideCreateCheckinPost(
    {
      ...input,
      actorBannedAt,
      resolveMapsPin,
    },
    {
      kindEnabled: isComposerPostKindEnabled('checkin', pack.settings),
      holdForStaffReview: pack.settings.holdNewPostsForReview,
    },
  )
  if (!decided.ok) return decided

  try {
    await insertPostRow(decided.post)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_posts|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'invalid' }
    }
    throw error
  }
  const stored = await findPost(decided.post.id)
  return stored ? { ok: true, post: stored } : decided
}

/** Count votes per option for a poll post (feed display). */
export async function countPollVotesByOption(
  postId: string,
): Promise<Record<string, number>> {
  const pid = postId.trim()
  if (!pid) return {}
  try {
    const rows = await db
      .select({
        optionId: sfSocialPollVotes.optionId,
        count: sql<number>`count(*)::int`,
      })
      .from(sfSocialPollVotes)
      .where(eq(sfSocialPollVotes.postId, pid))
      .groupBy(sfSocialPollVotes.optionId)
    const out: Record<string, number> = {}
    for (const row of rows) {
      out[row.optionId] = Number(row.count) || 0
    }
    return out
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_poll_votes|does not exist|relation/i.test(msg)) return {}
    throw error
  }
}
