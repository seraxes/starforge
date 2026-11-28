/**
 * product:social challenges — timing, invites, entry likes, no share.
 *
 * endsAt = publishedAt + lengthDays × 24h. Accept window 24|48 must fit inside
 * length (48h needs lengthDays ≥ 2). Accept/upload deadlines are
 * min(phase end, endsAt). Likes live in sf_social_challenge_likes (not
 * reactions). Entrants cannot like. Challenge posts cannot be shared.
 * Second+ invite needs social.challenge.multi when Subscriptions is on;
 * when Subscriptions is off, a second invite is refused with no /plans link.
 */

import { canInteract, type CanInteractContext } from './interact'
import type { PostAudience, PostRecord } from './posts'

/** Matches Subscriptions ENTITLEMENT_KEYS.socialChallengeMulti. */
export const SOCIAL_CHALLENGE_MULTI_ENTITLEMENT = 'social.challenge.multi' as const

export const CHALLENGE_ACCEPT_WINDOW_HOURS = [24, 48] as const
export type ChallengeAcceptWindowHours = (typeof CHALLENGE_ACCEPT_WINDOW_HOURS)[number]

export const CHALLENGE_LENGTH_DAYS_MIN = 1
export const CHALLENGE_LENGTH_DAYS_MAX = 7

export const CHALLENGE_ENTRY_STATUSES = [
  'invited',
  'accepted',
  'submitted',
  'declined',
  'expired',
] as const
export type ChallengeEntryStatus = (typeof CHALLENGE_ENTRY_STATUSES)[number]

export const CHALLENGE_OUTCOMES = ['winner', 'draw', 'unanswered'] as const
export type ChallengeOutcome = (typeof CHALLENGE_OUTCOMES)[number]

export type ChallengeRecord = {
  id: string
  postId: string
  creatorUserId: string
  publishedAt: Date
  lengthDays: number
  acceptWindowHours: ChallengeAcceptWindowHours
  endsAt: Date
  lockedAt: Date | null
  outcome: ChallengeOutcome | null
  winnerEntryId: string | null
  extensions: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export type ChallengeEntryRecord = {
  id: string
  challengeId: string
  userId: string
  status: ChallengeEntryStatus
  isCreator: boolean
  invitedAt: Date | null
  acceptedAt: Date | null
  submittedAt: Date | null
  acceptDeadlineAt: Date | null
  uploadDeadlineAt: Date | null
  mediaId: string | null
  createdAt: Date
  updatedAt: Date
}

export type ChallengeLikeRecord = {
  id: string
  challengeId: string
  actorUserId: string
  entryId: string
  createdAt: Date
  updatedAt: Date
}

export type ChallengeRefuseReason =
  | 'invalid'
  | 'invalid_timing'
  | 'not_found'
  | 'locked'
  | 'not_friends'
  | 'blocked'
  | 'banned'
  | 'cannot_interact'
  | 'already_invited'
  | 'multi_required'
  | 'entrant_cannot_like'
  | 'not_entrant_entry'
  | 'share_forbidden'
  | 'invite_cap'
  | 'disabled'

export type ChallengeMultiGate = {
  /** product:subscriptions catalog toggle. */
  subscriptionsEnabled: boolean
  /** hasEntitlement(userId, social.challenge.multi). */
  hasMultiEntitlement: boolean
}

export type ChallengeMultiDecision =
  | { ok: true }
  | {
      ok: false
      reason: 'multi_required'
      /** `/plans` when Subscriptions is on; null when off. */
      plansHref: '/plans' | null
    }

export type CreateChallengeInput = {
  creatorUserId: string
  body?: string
  audience?: PostAudience
  /** Opening media for the creator entry (optional). */
  mediaId?: string | null
  publishedAt?: Date
  lengthDays: number
  acceptWindowHours: number
}

export type InviteToChallengeInput = {
  challengeId: string
  actorUserId: string
  inviteeUserId: string
  areFriends: boolean
  interact: CanInteractContext
  multi: ChallengeMultiGate
  /** Non-creator entries already on the challenge (before this invite). */
  existingInviteCount: number
  /**
   * Pack multi-challenge cap. When set, existingInviteCount >= inviteCap
   * is refused (`invite_cap`) after the entitlement gate.
   */
  inviteCap?: number
}

export type ChallengeLikeInput = {
  challengeId: string
  actorUserId: string
  entryId: string
  /** User ids with an entry on this challenge (creator + invitees). */
  entrantUserIds: readonly string[]
  interact: CanInteractContext
  /** Target entry must belong to this challenge. */
  entry: ChallengeEntryRecord | null
}

const MS_PER_HOUR = 60 * 60 * 1000
const MS_PER_DAY = 24 * MS_PER_HOUR

export function isChallengeAcceptWindowHours(
  value: number,
): value is ChallengeAcceptWindowHours {
  return value === 24 || value === 48
}

export function isChallengeEntryStatus(value: string): value is ChallengeEntryStatus {
  return (CHALLENGE_ENTRY_STATUSES as readonly string[]).includes(value)
}

export function isChallengeOutcome(value: string): value is ChallengeOutcome {
  return (CHALLENGE_OUTCOMES as readonly string[]).includes(value)
}

/** Challenge posts cannot be shared (slice 12 / 18). */
export function isChallengeShareForbidden(postKind: string): boolean {
  return postKind.trim() === 'challenge'
}

/**
 * endsAt = publishedAt + lengthDays × 24 hours.
 */
export function computeChallengeEndsAt(publishedAt: Date, lengthDays: number): Date {
  return new Date(publishedAt.getTime() + lengthDays * MS_PER_DAY)
}

/**
 * Accept window must fit inside contest length:
 * 24h → lengthDays ≥ 1; 48h → lengthDays ≥ 2.
 */
export function isValidChallengeTiming(input: {
  acceptWindowHours: number
  lengthDays: number
}): boolean {
  if (!isChallengeAcceptWindowHours(input.acceptWindowHours)) return false
  if (
    !Number.isInteger(input.lengthDays) ||
    input.lengthDays < CHALLENGE_LENGTH_DAYS_MIN ||
    input.lengthDays > CHALLENGE_LENGTH_DAYS_MAX
  ) {
    return false
  }
  const minDays = input.acceptWindowHours / 24
  return input.lengthDays >= minDays
}

/**
 * Accept / upload deadline = min(phaseEnd, endsAt).
 */
export function challengePhaseDeadline(phaseEnd: Date, endsAt: Date): Date {
  return phaseEnd.getTime() <= endsAt.getTime() ? phaseEnd : endsAt
}

export function computeAcceptDeadline(
  publishedAt: Date,
  acceptWindowHours: ChallengeAcceptWindowHours,
  endsAt: Date,
): Date {
  const phaseEnd = new Date(publishedAt.getTime() + acceptWindowHours * MS_PER_HOUR)
  return challengePhaseDeadline(phaseEnd, endsAt)
}

export function computeUploadDeadline(
  acceptedAt: Date,
  acceptWindowHours: ChallengeAcceptWindowHours,
  endsAt: Date,
): Date {
  const phaseEnd = new Date(acceptedAt.getTime() + acceptWindowHours * MS_PER_HOUR)
  return challengePhaseDeadline(phaseEnd, endsAt)
}

/**
 * Second+ invite gate. First invite (existingInviteCount === 0) always ok.
 * Subscriptions off → refuse with plansHref null.
 * Subscriptions on without entitlement → refuse with plansHref `/plans`.
 */
export function decideChallengeMultiInvite(
  existingInviteCount: number,
  multi: ChallengeMultiGate,
): ChallengeMultiDecision {
  if (existingInviteCount < 1) return { ok: true }
  if (!multi.subscriptionsEnabled) {
    return { ok: false, reason: 'multi_required', plansHref: null }
  }
  if (!multi.hasMultiEntitlement) {
    return { ok: false, reason: 'multi_required', plansHref: '/plans' }
  }
  return { ok: true }
}

export type CreateChallengeDecision =
  | {
      ok: true
      challenge: ChallengeRecord
      post: PostRecord
      creatorEntry: ChallengeEntryRecord
    }
  | { ok: false; reason: ChallengeRefuseReason }

export function decideCreateChallenge(
  input: CreateChallengeInput,
  opts?: {
    now?: Date
    newId?: () => string
    /** Pack allowChallenge switch. false → disabled. */
    kindEnabled?: boolean
    holdForStaffReview?: boolean
    /** Pack window switch. false → invalid_timing. */
    windowAllowed?: boolean
    /** Pack min/max length. false → invalid_timing. */
    lengthAllowed?: boolean
  },
): CreateChallengeDecision {
  const creatorUserId = input.creatorUserId.trim()
  if (!creatorUserId) return { ok: false, reason: 'invalid' }
  if (opts?.kindEnabled === false) return { ok: false, reason: 'disabled' }
  if (!isValidChallengeTiming(input)) return { ok: false, reason: 'invalid_timing' }
  if (opts?.windowAllowed === false) return { ok: false, reason: 'invalid_timing' }
  if (opts?.lengthAllowed === false) return { ok: false, reason: 'invalid_timing' }

  const acceptWindowHours = input.acceptWindowHours as ChallengeAcceptWindowHours
  const lengthDays = input.lengthDays
  const now = opts?.now ?? new Date()
  const publishedAt = input.publishedAt ?? now
  const newId = opts?.newId ?? (() => crypto.randomUUID())
  const endsAt = computeChallengeEndsAt(publishedAt, lengthDays)
  const postId = newId()
  const challengeId = newId()
  const entryId = newId()
  const mediaId = input.mediaId?.trim() || null
  const audience = input.audience ?? 'friends'
  const body = (input.body ?? '').trim()

  const post: PostRecord = {
    id: postId,
    authorUserId: creatorUserId,
    body,
    kind: 'challenge',
    audience,
    groupId: null,
    pageId: null,
    staffHidden: false,
    pendingReview: Boolean(opts?.holdForStaffReview),
    isAnnouncement: false,
    editedAt: null,
    extensions: {},
    media: mediaId
      ? [{ mediaId, role: 'challenge_entry', sortOrder: 0, mimeType: null }]
      : [],
    sharedPostId: null,
    linkUrl: null,
    linkTitle: null,
    linkDescription: null,
    linkImageUrl: null,
    pollOptions: [],
    pollClosedAt: null,
    placeLabel: null,
    mapsPinId: null,
    placeLat: null,
    placeLng: null,
    createdAt: publishedAt,
    updatedAt: publishedAt,
  }

  const challenge: ChallengeRecord = {
    id: challengeId,
    postId,
    creatorUserId,
    publishedAt,
    lengthDays,
    acceptWindowHours,
    endsAt,
    lockedAt: null,
    outcome: null,
    winnerEntryId: null,
    extensions: {},
    createdAt: publishedAt,
    updatedAt: publishedAt,
  }

  const creatorEntry: ChallengeEntryRecord = {
    id: entryId,
    challengeId,
    userId: creatorUserId,
    status: mediaId ? 'submitted' : 'accepted',
    isCreator: true,
    invitedAt: null,
    acceptedAt: publishedAt,
    submittedAt: mediaId ? publishedAt : null,
    acceptDeadlineAt: null,
    uploadDeadlineAt: computeUploadDeadline(publishedAt, acceptWindowHours, endsAt),
    mediaId,
    createdAt: publishedAt,
    updatedAt: publishedAt,
  }

  return { ok: true, challenge, post, creatorEntry }
}

export type InviteChallengeDecision =
  | { ok: true; entry: ChallengeEntryRecord; plansHref?: undefined }
  | { ok: false; reason: ChallengeRefuseReason; plansHref?: '/plans' | null }

export function decideInviteToChallenge(
  challenge: ChallengeRecord | null,
  input: InviteToChallengeInput,
  opts?: { now?: Date; newId?: () => string },
): InviteChallengeDecision {
  if (!challenge) return { ok: false, reason: 'not_found' }
  const actor = input.actorUserId.trim()
  const invitee = input.inviteeUserId.trim()
  if (!actor || !invitee || actor === invitee) return { ok: false, reason: 'invalid' }
  if (challenge.id !== input.challengeId.trim()) return { ok: false, reason: 'invalid' }
  if (challenge.lockedAt) return { ok: false, reason: 'locked' }

  const now = opts?.now ?? new Date()
  if (now.getTime() >= challenge.endsAt.getTime()) return { ok: false, reason: 'locked' }

  if (actor !== challenge.creatorUserId) return { ok: false, reason: 'invalid' }
  if (!input.areFriends) return { ok: false, reason: 'not_friends' }

  if (!canInteract(actor, invitee, input.interact)) {
    if (input.interact.isBlocked) return { ok: false, reason: 'blocked' }
    return { ok: false, reason: 'cannot_interact' }
  }

  const multi = decideChallengeMultiInvite(input.existingInviteCount, input.multi)
  if (!multi.ok) {
    return { ok: false, reason: 'multi_required', plansHref: multi.plansHref }
  }

  if (
    typeof input.inviteCap === 'number' &&
    Number.isFinite(input.inviteCap) &&
    input.existingInviteCount >= input.inviteCap
  ) {
    return { ok: false, reason: 'invite_cap' }
  }

  const newId = opts?.newId ?? (() => crypto.randomUUID())
  const acceptDeadlineAt = computeAcceptDeadline(
    challenge.publishedAt,
    challenge.acceptWindowHours,
    challenge.endsAt,
  )
  if (now.getTime() > acceptDeadlineAt.getTime()) {
    return { ok: false, reason: 'locked' }
  }

  const entry: ChallengeEntryRecord = {
    id: newId(),
    challengeId: challenge.id,
    userId: invitee,
    status: 'invited',
    isCreator: false,
    invitedAt: now,
    acceptedAt: null,
    submittedAt: null,
    acceptDeadlineAt,
    uploadDeadlineAt: null,
    mediaId: null,
    createdAt: now,
    updatedAt: now,
  }
  return { ok: true, entry }
}

export type ChallengeLikeDecision =
  | { ok: true; write: 'insert' | 'update' | 'noop'; like: ChallengeLikeRecord }
  | { ok: false; reason: ChallengeRefuseReason }

export function decideChallengeLike(
  challenge: ChallengeRecord | null,
  current: ChallengeLikeRecord | null,
  input: ChallengeLikeInput,
  opts?: { now?: Date; newId?: () => string },
): ChallengeLikeDecision {
  if (!challenge) return { ok: false, reason: 'not_found' }
  if (challenge.lockedAt) return { ok: false, reason: 'locked' }
  const actor = input.actorUserId.trim()
  const entryId = input.entryId.trim()
  if (!actor || !entryId) return { ok: false, reason: 'invalid' }
  if (!input.entry || input.entry.id !== entryId) return { ok: false, reason: 'not_found' }
  if (input.entry.challengeId !== challenge.id) {
    return { ok: false, reason: 'not_entrant_entry' }
  }

  const entrants = new Set(input.entrantUserIds.map((id) => id.trim()).filter(Boolean))
  if (entrants.has(actor)) return { ok: false, reason: 'entrant_cannot_like' }

  if (!canInteract(actor, challenge.creatorUserId, input.interact)) {
    if (input.interact.isBlocked) return { ok: false, reason: 'blocked' }
    return { ok: false, reason: 'cannot_interact' }
  }

  const now = opts?.now ?? new Date()
  if (now.getTime() >= challenge.endsAt.getTime()) return { ok: false, reason: 'locked' }

  if (current && current.challengeId === challenge.id && current.actorUserId === actor) {
    if (current.entryId === entryId) {
      return { ok: true, write: 'noop', like: current }
    }
    return {
      ok: true,
      write: 'update',
      like: { ...current, entryId, updatedAt: now },
    }
  }

  const newId = opts?.newId ?? (() => crypto.randomUUID())
  return {
    ok: true,
    write: 'insert',
    like: {
      id: newId(),
      challengeId: challenge.id,
      actorUserId: actor,
      entryId,
      createdAt: now,
      updatedAt: now,
    },
  }
}

export type ChallengeSweepEntryPatch = {
  entryId: string
  status: 'expired'
  updatedAt: Date
}

export type ChallengeSweepLock = {
  challengeId: string
  lockedAt: Date
  outcome: ChallengeOutcome
  winnerEntryId: string | null
}

export type ChallengeSweepDecision = {
  expireEntries: ChallengeSweepEntryPatch[]
  locks: ChallengeSweepLock[]
}

/**
 * Challenge handler for social.sweep: expire overdue invites/uploads, lock
 * past endsAt, write outcome (most likes among submitted; tie = draw; <2 = unanswered).
 */
export function decideChallengeSweep(
  challenges: readonly ChallengeRecord[],
  entries: readonly ChallengeEntryRecord[],
  likes: readonly ChallengeLikeRecord[],
  now: Date,
): ChallengeSweepDecision {
  const expireEntries: ChallengeSweepEntryPatch[] = []
  const locks: ChallengeSweepLock[] = []
  const entriesByChallenge = new Map<string, ChallengeEntryRecord[]>()
  for (const entry of entries) {
    const list = entriesByChallenge.get(entry.challengeId) ?? []
    list.push(entry)
    entriesByChallenge.set(entry.challengeId, list)
  }
  const likesByChallenge = new Map<string, ChallengeLikeRecord[]>()
  for (const like of likes) {
    const list = likesByChallenge.get(like.challengeId) ?? []
    list.push(like)
    likesByChallenge.set(like.challengeId, list)
  }

  for (const challenge of challenges) {
    const list = entriesByChallenge.get(challenge.id) ?? []
    for (const entry of list) {
      if (entry.status === 'invited' && entry.acceptDeadlineAt) {
        if (now.getTime() > entry.acceptDeadlineAt.getTime()) {
          expireEntries.push({
            entryId: entry.id,
            status: 'expired',
            updatedAt: now,
          })
        }
      } else if (entry.status === 'accepted' && entry.uploadDeadlineAt) {
        if (now.getTime() > entry.uploadDeadlineAt.getTime()) {
          expireEntries.push({
            entryId: entry.id,
            status: 'expired',
            updatedAt: now,
          })
        }
      }
    }

    if (challenge.lockedAt) continue
    if (now.getTime() < challenge.endsAt.getTime()) continue

    const expiredIds = new Set(
      expireEntries
        .filter((row) => list.some((e) => e.id === row.entryId))
        .map((row) => row.entryId),
    )
    const submitted = list.filter(
      (entry) => entry.status === 'submitted' && !expiredIds.has(entry.id),
    )
    if (submitted.length < 2) {
      locks.push({
        challengeId: challenge.id,
        lockedAt: now,
        outcome: 'unanswered',
        winnerEntryId: null,
      })
      continue
    }

    const challengeLikes = likesByChallenge.get(challenge.id) ?? []
    const counts = new Map<string, number>()
    for (const entry of submitted) counts.set(entry.id, 0)
    for (const like of challengeLikes) {
      if (counts.has(like.entryId)) {
        counts.set(like.entryId, (counts.get(like.entryId) ?? 0) + 1)
      }
    }
    let bestId: string | null = null
    let bestCount = -1
    let tie = false
    for (const [entryId, count] of counts) {
      if (count > bestCount) {
        bestCount = count
        bestId = entryId
        tie = false
      } else if (count === bestCount) {
        tie = true
      }
    }
    if (tie || bestId == null) {
      locks.push({
        challengeId: challenge.id,
        lockedAt: now,
        outcome: 'draw',
        winnerEntryId: null,
      })
    } else {
      locks.push({
        challengeId: challenge.id,
        lockedAt: now,
        outcome: 'winner',
        winnerEntryId: bestId,
      })
    }
  }

  return { expireEntries, locks }
}

export type ChallengeBag = {
  challenges: Map<string, ChallengeRecord>
  entries: Map<string, ChallengeEntryRecord>
  likes: Map<string, ChallengeLikeRecord>
  posts: Map<string, PostRecord>
}

export function applyCreateChallenge(
  bag: ChallengeBag,
  input: CreateChallengeInput,
  opts?: { now?: Date; newId?: () => string },
): CreateChallengeDecision {
  const decision = decideCreateChallenge(input, opts)
  if (!decision.ok) return decision
  bag.challenges.set(decision.challenge.id, decision.challenge)
  bag.posts.set(decision.post.id, decision.post)
  bag.entries.set(decision.creatorEntry.id, decision.creatorEntry)
  return decision
}

export function applyInviteToChallenge(
  bag: ChallengeBag,
  input: Omit<InviteToChallengeInput, 'existingInviteCount' | 'challengeId'> & {
    challengeId: string
  },
  opts?: { now?: Date; newId?: () => string },
): InviteChallengeDecision {
  const challenge = bag.challenges.get(input.challengeId.trim()) ?? null
  const existingInviteCount = [...bag.entries.values()].filter(
    (row) => row.challengeId === input.challengeId.trim() && !row.isCreator,
  ).length
  const decision = decideInviteToChallenge(
    challenge,
    { ...input, existingInviteCount },
    opts,
  )
  if (!decision.ok) return decision
  // Uniqueness: one entry per (challengeId, userId) — refuse second insert.
  for (const row of bag.entries.values()) {
    if (row.challengeId === decision.entry.challengeId && row.userId === decision.entry.userId) {
      return { ok: false, reason: 'already_invited' }
    }
  }
  bag.entries.set(decision.entry.id, decision.entry)
  return decision
}

/**
 * Persist invite then emit mail. Mail failure does not roll back the entry.
 */
export async function inviteToChallengeWithMail(
  persist: () => Promise<InviteChallengeDecision> | InviteChallengeDecision,
  emitMail: (entry: ChallengeEntryRecord) => Promise<void>,
): Promise<InviteChallengeDecision> {
  const result = await persist()
  if (!result.ok) return result
  try {
    await emitMail(result.entry)
  } catch {
    // Soft-fail — the invite row must stay.
  }
  return result
}

export function applyChallengeLike(
  bag: ChallengeBag,
  input: Omit<ChallengeLikeInput, 'entrantUserIds' | 'entry'> & {
    entryId: string
  },
  opts?: { now?: Date; newId?: () => string },
): ChallengeLikeDecision {
  const challenge = bag.challenges.get(input.challengeId.trim()) ?? null
  const entry = [...bag.entries.values()].find((row) => row.id === input.entryId.trim()) ?? null
  const entrantUserIds = [...bag.entries.values()]
    .filter((row) => row.challengeId === input.challengeId.trim())
    .map((row) => row.userId)
  const current =
    [...bag.likes.values()].find(
      (row) =>
        row.challengeId === input.challengeId.trim() &&
        row.actorUserId === input.actorUserId.trim(),
    ) ?? null
  const decision = decideChallengeLike(
    challenge,
    current,
    { ...input, entrantUserIds, entry },
    opts,
  )
  if (!decision.ok) return decision
  if (decision.write === 'insert' || decision.write === 'update') {
    bag.likes.set(decision.like.id, decision.like)
  }
  return decision
}

export function applyChallengeSweep(bag: ChallengeBag, now: Date): ChallengeSweepDecision {
  const decision = decideChallengeSweep(
    [...bag.challenges.values()],
    [...bag.entries.values()],
    [...bag.likes.values()],
    now,
  )
  for (const patch of decision.expireEntries) {
    const entry = bag.entries.get(patch.entryId)
    if (!entry) continue
    bag.entries.set(patch.entryId, {
      ...entry,
      status: patch.status,
      updatedAt: patch.updatedAt,
    })
  }
  for (const lock of decision.locks) {
    const challenge = bag.challenges.get(lock.challengeId)
    if (!challenge) continue
    bag.challenges.set(lock.challengeId, {
      ...challenge,
      lockedAt: lock.lockedAt,
      outcome: lock.outcome,
      winnerEntryId: lock.winnerEntryId,
      updatedAt: lock.lockedAt,
    })
  }
  return decision
}

export function createChallengeMemory(opts?: {
  now?: () => Date
  newId?: () => string
}): {
  bag: ChallengeBag
  create: (input: CreateChallengeInput) => CreateChallengeDecision
  invite: (
    input: Omit<InviteToChallengeInput, 'existingInviteCount'>,
  ) => InviteChallengeDecision
  inviteWithMail: (
    input: Omit<InviteToChallengeInput, 'existingInviteCount'>,
    emitMail: (entry: ChallengeEntryRecord) => Promise<void>,
  ) => Promise<InviteChallengeDecision>
  like: (
    input: Omit<ChallengeLikeInput, 'entrantUserIds' | 'entry'> & { entryId: string },
  ) => ChallengeLikeDecision
  sweep: (now?: Date) => ChallengeSweepDecision
  countInvites: (challengeId: string) => number
} {
  const bag: ChallengeBag = {
    challenges: new Map(),
    entries: new Map(),
    likes: new Map(),
    posts: new Map(),
  }
  const now = opts?.now ?? (() => new Date())
  const newId = opts?.newId ?? (() => crypto.randomUUID())

  return {
    bag,
    create: (input) => applyCreateChallenge(bag, input, { now: now(), newId }),
    invite: (input) => applyInviteToChallenge(bag, input, { now: now(), newId }),
    inviteWithMail: (input, emitMail) =>
      inviteToChallengeWithMail(
        () => applyInviteToChallenge(bag, input, { now: now(), newId }),
        emitMail,
      ),
    like: (input) => applyChallengeLike(bag, input, { now: now(), newId }),
    sweep: (at) => applyChallengeSweep(bag, at ?? now()),
    countInvites: (challengeId) =>
      [...bag.entries.values()].filter(
        (row) => row.challengeId === challengeId && !row.isCreator,
      ).length,
  }
}
