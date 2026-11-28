/**
 * product:social challenge persistence (sf_social_challenges / entries / likes).
 *
 * Unique challenge likes: (actorUserId, challengeId). Entrants cannot like.
 * Invite mail is soft-fail (see inviteToChallengeWithMail).
 */

import 'server-only'

import { and, eq, inArray, isNull } from 'drizzle-orm'

import { db } from '@/core/db'

import { SOCIAL_MULTI_CHALLENGE_CAP_DEFAULT } from './pack-settings'
import { loadSocialModuleSettings } from './settings'
import {
  decideChallengeLike,
  decideChallengeSweep,
  decideCreateChallenge,
  decideInviteToChallenge,
  isChallengeAcceptWindowHours,
  isChallengeEntryStatus,
  isChallengeOutcome,
  type ChallengeEntryRecord,
  type ChallengeLikeRecord,
  type ChallengeMultiGate,
  type ChallengeRecord,
  type CreateChallengeDecision,
  type CreateChallengeInput,
  type InviteChallengeDecision,
  type ChallengeLikeDecision,
} from './challenge'
import type { CanInteractContext } from './interact'
import {
  sfSocialChallengeEntries,
  sfSocialChallengeLikes,
  sfSocialChallenges,
  sfSocialPosts,
} from './schema'

export type ChallengeSweepDbResult = {
  expiredEntries: number
  locked: number
}

function mapChallenge(
  row: typeof sfSocialChallenges.$inferSelect,
): ChallengeRecord | null {
  if (!isChallengeAcceptWindowHours(row.acceptWindowHours)) return null
  const outcome =
    row.outcome && isChallengeOutcome(row.outcome) ? row.outcome : null
  return {
    id: row.id,
    postId: row.postId,
    creatorUserId: row.creatorUserId,
    publishedAt: row.publishedAt,
    lengthDays: row.lengthDays,
    acceptWindowHours: row.acceptWindowHours,
    endsAt: row.endsAt,
    lockedAt: row.lockedAt,
    outcome,
    winnerEntryId: row.winnerEntryId,
    extensions:
      row.extensions && typeof row.extensions === 'object' && !Array.isArray(row.extensions)
        ? (row.extensions as Record<string, unknown>)
        : {},
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapEntry(
  row: typeof sfSocialChallengeEntries.$inferSelect,
): ChallengeEntryRecord | null {
  if (!isChallengeEntryStatus(row.status)) return null
  return {
    id: row.id,
    challengeId: row.challengeId,
    userId: row.userId,
    status: row.status,
    isCreator: row.isCreator,
    invitedAt: row.invitedAt,
    acceptedAt: row.acceptedAt,
    submittedAt: row.submittedAt,
    acceptDeadlineAt: row.acceptDeadlineAt,
    uploadDeadlineAt: row.uploadDeadlineAt,
    mediaId: row.mediaId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapLike(
  row: typeof sfSocialChallengeLikes.$inferSelect,
): ChallengeLikeRecord {
  return {
    id: row.id,
    challengeId: row.challengeId,
    actorUserId: row.actorUserId,
    entryId: row.entryId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function findChallengeById(
  challengeId: string,
): Promise<ChallengeRecord | null> {
  const id = challengeId.trim()
  if (!id) return null
  const rows = await db
    .select()
    .from(sfSocialChallenges)
    .where(eq(sfSocialChallenges.id, id))
    .limit(1)
  const row = rows[0]
  return row ? mapChallenge(row) : null
}

export async function createChallengeInDb(
  input: CreateChallengeInput,
  opts?: { now?: Date; newId?: () => string },
): Promise<CreateChallengeDecision> {
  const pack = await loadSocialModuleSettings()
  const {
    isChallengeAcceptWindowAllowed,
    isChallengeLengthDaysAllowed,
    isComposerPostKindEnabled,
  } = await import('./pack-settings')
  const decision = decideCreateChallenge(input, {
    ...opts,
    kindEnabled: isComposerPostKindEnabled('challenge', pack.settings),
    holdForStaffReview: pack.settings.holdNewPostsForReview,
    windowAllowed: isChallengeAcceptWindowAllowed(
      input.acceptWindowHours,
      pack.settings,
    ),
    lengthAllowed: isChallengeLengthDaysAllowed(input.lengthDays, pack.settings),
  })
  if (!decision.ok) return decision

  await db.transaction(async (tx) => {
    await tx.insert(sfSocialPosts).values({
      id: decision.post.id,
      authorUserId: decision.post.authorUserId,
      body: decision.post.body,
      kind: decision.post.kind,
      audience: decision.post.audience,
      groupId: null,
      pageId: null,
      staffHidden: decision.post.staffHidden,
      pendingReview: decision.post.pendingReview,
      isAnnouncement: false,
      editedAt: null,
      extensions: {},
      createdAt: decision.post.createdAt,
      updatedAt: decision.post.updatedAt,
    })
    await tx.insert(sfSocialChallenges).values({
      id: decision.challenge.id,
      postId: decision.challenge.postId,
      creatorUserId: decision.challenge.creatorUserId,
      publishedAt: decision.challenge.publishedAt,
      lengthDays: decision.challenge.lengthDays,
      acceptWindowHours: decision.challenge.acceptWindowHours,
      endsAt: decision.challenge.endsAt,
      lockedAt: null,
      outcome: null,
      winnerEntryId: null,
      extensions: {},
      createdAt: decision.challenge.createdAt,
      updatedAt: decision.challenge.updatedAt,
    })
    await tx.insert(sfSocialChallengeEntries).values({
      id: decision.creatorEntry.id,
      challengeId: decision.creatorEntry.challengeId,
      userId: decision.creatorEntry.userId,
      status: decision.creatorEntry.status,
      isCreator: true,
      invitedAt: null,
      acceptedAt: decision.creatorEntry.acceptedAt,
      submittedAt: decision.creatorEntry.submittedAt,
      acceptDeadlineAt: null,
      uploadDeadlineAt: decision.creatorEntry.uploadDeadlineAt,
      mediaId: decision.creatorEntry.mediaId,
      createdAt: decision.creatorEntry.createdAt,
      updatedAt: decision.creatorEntry.updatedAt,
    })
  })

  return decision
}

export async function inviteToChallengeInDb(input: {
  challengeId: string
  actorUserId: string
  inviteeUserId: string
  areFriends: boolean
  interact: CanInteractContext
  multi: ChallengeMultiGate
}): Promise<InviteChallengeDecision> {
  const challenge = await findChallengeById(input.challengeId)
  if (!challenge) return { ok: false, reason: 'not_found' }

  const existing = await db
    .select({ id: sfSocialChallengeEntries.id })
    .from(sfSocialChallengeEntries)
    .where(
      and(
        eq(sfSocialChallengeEntries.challengeId, challenge.id),
        eq(sfSocialChallengeEntries.isCreator, false),
      ),
    )
  const existingInviteCount = existing.length

  const inviteeRows = await db
    .select({ id: sfSocialChallengeEntries.id })
    .from(sfSocialChallengeEntries)
    .where(
      and(
        eq(sfSocialChallengeEntries.challengeId, challenge.id),
        eq(sfSocialChallengeEntries.userId, input.inviteeUserId.trim()),
      ),
    )
    .limit(1)
  if (inviteeRows[0]) return { ok: false, reason: 'already_invited' }

  let inviteCap = SOCIAL_MULTI_CHALLENGE_CAP_DEFAULT
  try {
    const loaded = await loadSocialModuleSettings()
    inviteCap = loaded.settings.multiChallengeCap
  } catch {
    inviteCap = SOCIAL_MULTI_CHALLENGE_CAP_DEFAULT
  }

  const decision = decideInviteToChallenge(challenge, {
    ...input,
    existingInviteCount,
    inviteCap,
  })
  if (!decision.ok) return decision

  await db.insert(sfSocialChallengeEntries).values({
    id: decision.entry.id,
    challengeId: decision.entry.challengeId,
    userId: decision.entry.userId,
    status: decision.entry.status,
    isCreator: false,
    invitedAt: decision.entry.invitedAt,
    acceptedAt: null,
    submittedAt: null,
    acceptDeadlineAt: decision.entry.acceptDeadlineAt,
    uploadDeadlineAt: null,
    mediaId: null,
    createdAt: decision.entry.createdAt,
    updatedAt: decision.entry.updatedAt,
  })

  return decision
}

export async function setChallengeLikeInDb(input: {
  challengeId: string
  actorUserId: string
  entryId: string
  interact: CanInteractContext
}): Promise<ChallengeLikeDecision> {
  const challenge = await findChallengeById(input.challengeId)
  if (!challenge) return { ok: false, reason: 'not_found' }

  const entryRows = await db
    .select()
    .from(sfSocialChallengeEntries)
    .where(eq(sfSocialChallengeEntries.id, input.entryId.trim()))
    .limit(1)
  const entryRow = entryRows[0]
  const entry = entryRow ? mapEntry(entryRow) : null

  const entrantRows = await db
    .select({ userId: sfSocialChallengeEntries.userId })
    .from(sfSocialChallengeEntries)
    .where(eq(sfSocialChallengeEntries.challengeId, challenge.id))
  const entrantUserIds = entrantRows.map((row) => row.userId)

  const likeRows = await db
    .select()
    .from(sfSocialChallengeLikes)
    .where(
      and(
        eq(sfSocialChallengeLikes.challengeId, challenge.id),
        eq(sfSocialChallengeLikes.actorUserId, input.actorUserId.trim()),
      ),
    )
    .limit(1)
  const current = likeRows[0] ? mapLike(likeRows[0]) : null

  const decision = decideChallengeLike(
    challenge,
    current,
    {
      challengeId: challenge.id,
      actorUserId: input.actorUserId,
      entryId: input.entryId,
      entrantUserIds,
      interact: input.interact,
      entry,
    },
  )
  if (!decision.ok) return decision

  if (decision.write === 'insert') {
    await db.insert(sfSocialChallengeLikes).values({
      id: decision.like.id,
      challengeId: decision.like.challengeId,
      actorUserId: decision.like.actorUserId,
      entryId: decision.like.entryId,
      createdAt: decision.like.createdAt,
      updatedAt: decision.like.updatedAt,
    })
  } else if (decision.write === 'update') {
    await db
      .update(sfSocialChallengeLikes)
      .set({
        entryId: decision.like.entryId,
        updatedAt: decision.like.updatedAt,
      })
      .where(eq(sfSocialChallengeLikes.id, decision.like.id))
  }

  return decision
}

/**
 * Apply decideChallengeSweep against open challenges in the DB.
 */
export async function applyChallengeSweepFromDb(
  now = new Date(),
): Promise<ChallengeSweepDbResult> {
  const openChallenges = await db
    .select()
    .from(sfSocialChallenges)
    .where(isNull(sfSocialChallenges.lockedAt))

  const challenges: ChallengeRecord[] = []
  for (const row of openChallenges) {
    const mapped = mapChallenge(row)
    if (mapped) challenges.push(mapped)
  }
  if (challenges.length === 0) return { expiredEntries: 0, locked: 0 }

  const challengeIds = challenges.map((row) => row.id)
  const entryRows = await db
    .select()
    .from(sfSocialChallengeEntries)
    .where(inArray(sfSocialChallengeEntries.challengeId, challengeIds))
  const likeRows = await db
    .select()
    .from(sfSocialChallengeLikes)
    .where(inArray(sfSocialChallengeLikes.challengeId, challengeIds))

  const entries = entryRows
    .map(mapEntry)
    .filter((row): row is ChallengeEntryRecord => row != null)
  const likes = likeRows.map(mapLike)

  const decision = decideChallengeSweep(challenges, entries, likes, now)

  await db.transaction(async (tx) => {
    for (const patch of decision.expireEntries) {
      await tx
        .update(sfSocialChallengeEntries)
        .set({ status: patch.status, updatedAt: patch.updatedAt })
        .where(eq(sfSocialChallengeEntries.id, patch.entryId))
    }
    for (const lock of decision.locks) {
      await tx
        .update(sfSocialChallenges)
        .set({
          lockedAt: lock.lockedAt,
          outcome: lock.outcome,
          winnerEntryId: lock.winnerEntryId,
          updatedAt: lock.lockedAt,
        })
        .where(eq(sfSocialChallenges.id, lock.challengeId))
    }
  })

  return {
    expiredEntries: decision.expireEntries.length,
    locked: decision.locks.length,
  }
}
