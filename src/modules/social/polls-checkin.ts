/**
 * product:social polls + check-in (slice 21).
 *
 * Poll: single-choice options on the post (Social-owned, not a Forms definition).
 * Votes are sf_social_poll_votes — unique (postId, userId), changeable until close.
 * A closed poll cannot be edited (named failure).
 *
 * Check-in: place label always saves. Maps pin is optional — when the Maps door
 * fails, the label still saves and the pin is omitted (named soft path).
 * Voting calls canInteract; it does not re-derive the block rule.
 */

import { canInteract, isSocialBanned, type CanInteractContext } from './interact'
import {
  emptyPollCheckinFields,
  emptyShareLinkFields,
  isPostAudience,
  normalizePollOptions,
  type PollOption,
  type PostAudience,
  type PostRecord,
} from './posts'

export const POLL_OPTIONS_MIN = 2
export const POLL_OPTIONS_MAX = 10

export type PollVoteRecord = {
  id: string
  postId: string
  userId: string
  optionId: string
  createdAt: Date
  updatedAt: Date
}

export type PollCheckinRefuseReason =
  | 'invalid'
  | 'invalid_audience'
  | 'group_required'
  | 'banned'
  | 'not_found'
  | 'not_author'
  | 'not_poll'
  | 'closed'
  | 'invalid_option'
  | 'cannot_view'
  | 'cannot_interact'
  | 'blocked'
  | 'empty_label'
  | 'disabled_kind'

export type PollCheckinMutationResult =
  | { ok: true; post: PostRecord }
  | { ok: false; reason: PollCheckinRefuseReason }

export type PollVoteMutationResult =
  | { ok: true; vote: PollVoteRecord; write: 'insert' | 'update' }
  | { ok: false; reason: PollCheckinRefuseReason }

export type MapsPinResolveResult = {
  pinId: string
  lat?: number | null
  lng?: number | null
}

/** Sync Maps door stub for unit tests. Null / throw → pin omitted. */
export type MapsPinResolve = (label: string) => MapsPinResolveResult | null

export type CreatePollPostInput = {
  authorUserId: string
  body?: string
  options: Array<string | { id?: string; label: string }>
  audience?: PostAudience | string
  groupId?: string | null
  pageId?: string | null
  extensions?: Record<string, unknown>
  actorBannedAt?: Date | null
}

export type EditPollPostInput = {
  actorUserId: string
  postId: string
  body?: string
  options?: Array<string | { id?: string; label: string }>
}

export type ClosePollInput = {
  actorUserId: string
  postId: string
}

export type VotePollInput = {
  userId: string
  postId: string
  optionId: string
  /** Author Social bannedAt for the voter. */
  actorBannedAt?: Date | null
  interact: CanInteractContext
  canView: boolean
}

export type CreateCheckinPostInput = {
  authorUserId: string
  placeLabel: string
  body?: string
  audience?: PostAudience | string
  groupId?: string | null
  pageId?: string | null
  extensions?: Record<string, unknown>
  actorBannedAt?: Date | null
  /**
   * Maps door. Null / throw → label still saves, pin omitted.
   * Store path catches async failures the same way.
   */
  resolveMapsPin?: MapsPinResolve
}

export function pollVotePairKey(postId: string, userId: string): string {
  return `${postId.trim()}\0${userId.trim()}`
}

function resolveAudience(
  raw: PostAudience | string | undefined,
  groupId: string | null,
):
  | { ok: true; audience: PostAudience; groupId: string | null }
  | { ok: false; reason: PollCheckinRefuseReason } {
  const audience =
    typeof raw === 'string' && raw.trim() === ''
      ? 'friends'
      : typeof raw === 'string'
        ? raw.trim()
        : (raw ?? 'friends')
  if (!isPostAudience(audience)) return { ok: false, reason: 'invalid_audience' }
  if (audience === 'group' && !groupId) {
    return { ok: false, reason: 'group_required' }
  }
  return {
    ok: true,
    audience,
    groupId: audience === 'group' ? groupId : null,
  }
}

/**
 * Normalize composer option labels into PollOption rows with stable ids.
 * Blanks dropped. Count must be POLL_OPTIONS_MIN..POLL_OPTIONS_MAX.
 */
export function buildPollOptions(
  raw: Array<string | { id?: string; label: string }>,
  newId: () => string,
): { ok: true; options: PollOption[] } | { ok: false; reason: 'invalid' } {
  const options: PollOption[] = []
  const seenIds = new Set<string>()
  const seenLabels = new Set<string>()
  for (const item of raw) {
    const label =
      typeof item === 'string'
        ? item.trim()
        : typeof item?.label === 'string'
          ? item.label.trim()
          : ''
    if (!label) continue
    const labelKey = label.toLowerCase()
    if (seenLabels.has(labelKey)) continue
    seenLabels.add(labelKey)
    const preferred =
      typeof item === 'object' && typeof item.id === 'string' ? item.id.trim() : ''
    const id = preferred && !seenIds.has(preferred) ? preferred : newId()
    seenIds.add(id)
    options.push({ id, label })
    if (options.length > POLL_OPTIONS_MAX) return { ok: false, reason: 'invalid' }
  }
  if (options.length < POLL_OPTIONS_MIN || options.length > POLL_OPTIONS_MAX) {
    return { ok: false, reason: 'invalid' }
  }
  return { ok: true, options }
}

export function isPollClosed(post: PostRecord): boolean {
  return post.kind === 'poll' && post.pollClosedAt != null
}

/** Create a kind=poll post with a single-choice option list. Pack off → disabled_kind. */
export function decideCreatePollPost(
  input: CreatePollPostInput,
  opts?: {
    now?: Date
    newId?: () => string
    kindEnabled?: boolean
    holdForStaffReview?: boolean
  },
): PollCheckinMutationResult {
  const authorUserId = input.authorUserId.trim()
  if (!authorUserId) return { ok: false, reason: 'invalid' }
  if (isSocialBanned(input.actorBannedAt ?? null)) {
    return { ok: false, reason: 'banned' }
  }
  if (opts?.kindEnabled === false) return { ok: false, reason: 'disabled_kind' }

  const newId = opts?.newId ?? (() => crypto.randomUUID())
  const built = buildPollOptions(input.options, newId)
  if (!built.ok) return built

  const groupId = input.groupId?.trim() || null
  const pageId = input.pageId?.trim() || null
  const audienceDecision = resolveAudience(input.audience, groupId)
  if (!audienceDecision.ok) return audienceDecision

  const now = opts?.now ?? new Date()
  return {
    ok: true,
    post: {
      id: newId(),
      authorUserId,
      body: (input.body ?? '').trim(),
      kind: 'poll',
      audience: audienceDecision.audience,
      groupId: audienceDecision.groupId,
      pageId,
      staffHidden: false,
      pendingReview: Boolean(opts?.holdForStaffReview),
      isAnnouncement: false,
      editedAt: null,
      extensions: input.extensions ?? {},
      media: [],
      ...emptyShareLinkFields(),
      ...emptyPollCheckinFields(),
      pollOptions: built.options,
      createdAt: now,
      updatedAt: now,
    },
  }
}

/**
 * Author edits poll body and/or options. Named failure: closed → refuse.
 */
export function decideEditPollPost(
  current: PostRecord | null,
  input: EditPollPostInput,
  opts?: { now?: Date; newId?: () => string },
): PollCheckinMutationResult {
  if (!current) return { ok: false, reason: 'not_found' }
  const actor = input.actorUserId.trim()
  if (!actor || current.id.trim() !== input.postId.trim()) {
    return { ok: false, reason: 'invalid' }
  }
  if (current.kind !== 'poll') return { ok: false, reason: 'not_poll' }
  if (current.authorUserId !== actor) return { ok: false, reason: 'not_author' }
  if (isPollClosed(current)) return { ok: false, reason: 'closed' }

  const newId = opts?.newId ?? (() => crypto.randomUUID())
  let pollOptions = current.pollOptions
  if (input.options !== undefined) {
    const built = buildPollOptions(input.options, newId)
    if (!built.ok) return built
    pollOptions = built.options
  }

  const body =
    input.body !== undefined ? input.body.trim() : current.body
  const now = opts?.now ?? new Date()
  return {
    ok: true,
    post: {
      ...current,
      body,
      pollOptions,
      editedAt: now,
      updatedAt: now,
    },
  }
}

/** Author closes the poll. Further edits and vote changes are refused. */
export function decideClosePoll(
  current: PostRecord | null,
  input: ClosePollInput,
  opts?: { now?: Date },
): PollCheckinMutationResult {
  if (!current) return { ok: false, reason: 'not_found' }
  const actor = input.actorUserId.trim()
  if (!actor || current.id.trim() !== input.postId.trim()) {
    return { ok: false, reason: 'invalid' }
  }
  if (current.kind !== 'poll') return { ok: false, reason: 'not_poll' }
  if (current.authorUserId !== actor) return { ok: false, reason: 'not_author' }
  if (isPollClosed(current)) {
    return { ok: true, post: current }
  }
  const now = opts?.now ?? new Date()
  return {
    ok: true,
    post: {
      ...current,
      pollClosedAt: now,
      updatedAt: now,
    },
  }
}

/**
 * Cast or change a vote. Unique (postId, userId): second vote updates optionId.
 * Requires canViewPost and canInteract with the author. Closed → refuse.
 */
export function decideVotePoll(
  post: PostRecord | null,
  current: PollVoteRecord | null,
  input: VotePollInput,
  opts?: { now?: Date; newId?: () => string },
): PollVoteMutationResult {
  const userId = input.userId.trim()
  const postId = input.postId.trim()
  const optionId = input.optionId.trim()
  if (!userId || !postId || !optionId) return { ok: false, reason: 'invalid' }
  if (!post || post.id.trim() !== postId) return { ok: false, reason: 'not_found' }
  if (post.kind !== 'poll') return { ok: false, reason: 'not_poll' }
  if (isPollClosed(post)) return { ok: false, reason: 'closed' }
  if (isSocialBanned(input.actorBannedAt ?? null)) {
    return { ok: false, reason: 'banned' }
  }
  if (!input.canView) return { ok: false, reason: 'cannot_view' }

  if (!canInteract(userId, post.authorUserId, input.interact)) {
    if (input.interact.isBlocked) return { ok: false, reason: 'blocked' }
    return { ok: false, reason: 'cannot_interact' }
  }

  const options = normalizePollOptions(post.pollOptions)
  if (!options.some((opt) => opt.id === optionId)) {
    return { ok: false, reason: 'invalid_option' }
  }

  const now = opts?.now ?? new Date()
  const newId = opts?.newId ?? (() => crypto.randomUUID())

  if (current && current.postId === postId && current.userId === userId) {
    return {
      ok: true,
      write: 'update',
      vote: { ...current, optionId, updatedAt: now },
    }
  }

  return {
    ok: true,
    write: 'insert',
    vote: {
      id: newId(),
      postId,
      userId,
      optionId,
      createdAt: now,
      updatedAt: now,
    },
  }
}

/**
 * Create a kind=checkin post. Maps door failure still saves the place label.
 * Pack switch off → disabled_kind.
 */
export function decideCreateCheckinPost(
  input: CreateCheckinPostInput,
  opts?: {
    now?: Date
    newId?: () => string
    kindEnabled?: boolean
    holdForStaffReview?: boolean
  },
): PollCheckinMutationResult {
  const authorUserId = input.authorUserId.trim()
  const placeLabel = input.placeLabel.trim()
  if (!authorUserId) return { ok: false, reason: 'invalid' }
  if (!placeLabel) return { ok: false, reason: 'empty_label' }
  if (isSocialBanned(input.actorBannedAt ?? null)) {
    return { ok: false, reason: 'banned' }
  }
  if (opts?.kindEnabled === false) return { ok: false, reason: 'disabled_kind' }

  const groupId = input.groupId?.trim() || null
  const pageId = input.pageId?.trim() || null
  const audienceDecision = resolveAudience(input.audience, groupId)
  if (!audienceDecision.ok) return audienceDecision

  let mapsPinId: string | null = null
  let placeLat: number | null = null
  let placeLng: number | null = null
  if (input.resolveMapsPin) {
    try {
      const pin = input.resolveMapsPin(placeLabel)
      if (pin?.pinId?.trim()) {
        mapsPinId = pin.pinId.trim()
        placeLat =
          typeof pin.lat === 'number' && Number.isFinite(pin.lat) ? pin.lat : null
        placeLng =
          typeof pin.lng === 'number' && Number.isFinite(pin.lng) ? pin.lng : null
      }
    } catch {
      // Maps door failed — label still saves; pin omitted.
    }
  }

  const now = opts?.now ?? new Date()
  const newId = opts?.newId ?? (() => crypto.randomUUID())
  return {
    ok: true,
    post: {
      id: newId(),
      authorUserId,
      body: (input.body ?? '').trim(),
      kind: 'checkin',
      audience: audienceDecision.audience,
      groupId: audienceDecision.groupId,
      pageId,
      staffHidden: false,
      pendingReview: Boolean(opts?.holdForStaffReview),
      isAnnouncement: false,
      editedAt: null,
      extensions: input.extensions ?? {},
      media: [],
      ...emptyShareLinkFields(),
      ...emptyPollCheckinFields(),
      placeLabel,
      mapsPinId,
      placeLat,
      placeLng,
      createdAt: now,
      updatedAt: now,
    },
  }
}

export type PollCheckinBag = {
  posts: Map<string, PostRecord>
  votes: Map<string, PollVoteRecord>
}

export function applyCreatePollPost(
  bag: PollCheckinBag,
  input: CreatePollPostInput,
  opts?: { now?: Date; newId?: () => string },
): PollCheckinMutationResult {
  const decision = decideCreatePollPost(input, opts)
  if (!decision.ok) return decision
  bag.posts.set(decision.post.id, decision.post)
  return decision
}

export function applyEditPollPost(
  bag: PollCheckinBag,
  input: EditPollPostInput,
  opts?: { now?: Date; newId?: () => string },
): PollCheckinMutationResult {
  const current = bag.posts.get(input.postId.trim()) ?? null
  const decision = decideEditPollPost(current, input, opts)
  if (!decision.ok) return decision
  bag.posts.set(decision.post.id, decision.post)
  return decision
}

export function applyClosePoll(
  bag: PollCheckinBag,
  input: ClosePollInput,
  opts?: { now?: Date },
): PollCheckinMutationResult {
  const current = bag.posts.get(input.postId.trim()) ?? null
  const decision = decideClosePoll(current, input, opts)
  if (!decision.ok) return decision
  bag.posts.set(decision.post.id, decision.post)
  return decision
}

export function applyVotePoll(
  bag: PollCheckinBag,
  input: VotePollInput,
  opts?: { now?: Date; newId?: () => string },
): PollVoteMutationResult {
  const post = bag.posts.get(input.postId.trim()) ?? null
  const key = pollVotePairKey(input.postId, input.userId)
  const current = bag.votes.get(key) ?? null
  const decision = decideVotePoll(post, current, input, opts)
  if (!decision.ok) return decision
  bag.votes.set(
    pollVotePairKey(decision.vote.postId, decision.vote.userId),
    decision.vote,
  )
  return decision
}

export function applyCreateCheckinPost(
  bag: PollCheckinBag,
  input: CreateCheckinPostInput,
  opts?: { now?: Date; newId?: () => string },
): PollCheckinMutationResult {
  const decision = decideCreateCheckinPost(input, opts)
  if (!decision.ok) return decision
  bag.posts.set(decision.post.id, decision.post)
  return decision
}

/** In-memory polls + check-ins for unit tests. */
export function createPollsCheckinMemory(opts?: {
  now?: () => Date
  newId?: () => string
}): {
  bag: PollCheckinBag
  createPoll: (input: CreatePollPostInput) => PollCheckinMutationResult
  editPoll: (input: EditPollPostInput) => PollCheckinMutationResult
  closePoll: (input: ClosePollInput) => PollCheckinMutationResult
  vote: (input: VotePollInput) => PollVoteMutationResult
  createCheckin: (input: CreateCheckinPostInput) => PollCheckinMutationResult
  getPost: (postId: string) => PostRecord | null
  getVote: (postId: string, userId: string) => PollVoteRecord | null
} {
  const bag: PollCheckinBag = {
    posts: new Map(),
    votes: new Map(),
  }
  const now = opts?.now ?? (() => new Date())
  const newId = opts?.newId ?? (() => crypto.randomUUID())

  return {
    bag,
    createPoll: (input) => applyCreatePollPost(bag, input, { now: now(), newId }),
    editPoll: (input) => applyEditPollPost(bag, input, { now: now(), newId }),
    closePoll: (input) => applyClosePoll(bag, input, { now: now() }),
    vote: (input) => applyVotePoll(bag, input, { now: now(), newId }),
    createCheckin: (input) =>
      applyCreateCheckinPost(bag, input, { now: now(), newId }),
    getPost: (postId) => bag.posts.get(postId.trim()) ?? null,
    getVote: (postId, userId) =>
      bag.votes.get(pollVotePairKey(postId, userId)) ?? null,
  }
}
