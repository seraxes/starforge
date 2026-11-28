/**
 * product:social quiet controls — hide a post / mute a person (viewer-only).
 *
 * Hide: unique (userId, postId); requires canViewPost; does not change the post
 * for anyone else. Mute: unique (muter, muted); does not touch friendship,
 * follow, or block; does not notify. Both are feed exclusions, not canViewPost
 * denials — permalinks stay readable when canViewPost allows.
 */

import { isSocialBanned } from './interact'
import type { PostRecord } from './posts'

export type PostHideRecord = {
  id: string
  userId: string
  postId: string
  createdAt: Date
  updatedAt: Date
}

export type MuteRecord = {
  id: string
  muterUserId: string
  mutedUserId: string
  createdAt: Date
  updatedAt: Date
}

export type QuietRefuseReason =
  | 'invalid'
  | 'self'
  | 'cannot_view'
  | 'banned'
  | 'not_hidden'
  | 'not_muted'

export type HidePostMutationResult =
  | { ok: true; hide: PostHideRecord; write: 'insert' | 'update' }
  | { ok: false; reason: QuietRefuseReason }

export type UnhidePostMutationResult =
  | { ok: true; removed: PostHideRecord }
  | { ok: false; reason: QuietRefuseReason }

export type MuteMutationResult =
  | { ok: true; mute: MuteRecord; write: 'insert' | 'update' }
  | { ok: false; reason: QuietRefuseReason }

export type UnmuteMutationResult =
  | { ok: true; removed: MuteRecord }
  | { ok: false; reason: QuietRefuseReason }

export type HidePostInput = {
  userId: string
  postId: string
  /** Viewer Social bannedAt — refuse when set. */
  actorBannedAt?: Date | null
}

export type MuteInput = {
  muterUserId: string
  mutedUserId: string
  /** Muter Social bannedAt — refuse when set. */
  actorBannedAt?: Date | null
}

export function hidePairKey(userId: string, postId: string): string {
  return `${userId.trim()}\0${postId.trim()}`
}

export function mutePairKey(muterUserId: string, mutedUserId: string): string {
  return `${muterUserId.trim()}\0${mutedUserId.trim()}`
}

/**
 * Hide a post the viewer can already see. Unique (userId, postId): second hide
 * updates the open row (idempotent).
 */
export function decideHidePost(
  current: PostHideRecord | null,
  input: HidePostInput,
  gates: { canView: boolean },
  opts?: { now?: Date; newId?: () => string },
): HidePostMutationResult {
  const userId = input.userId.trim()
  const postId = input.postId.trim()
  if (!userId || !postId) return { ok: false, reason: 'invalid' }
  if (isSocialBanned(input.actorBannedAt ?? null)) {
    return { ok: false, reason: 'banned' }
  }
  if (!gates.canView) return { ok: false, reason: 'cannot_view' }

  const now = opts?.now ?? new Date()
  const newId = opts?.newId ?? (() => crypto.randomUUID())

  if (current && current.userId === userId && current.postId === postId) {
    return {
      ok: true,
      write: 'update',
      hide: { ...current, updatedAt: now },
    }
  }

  return {
    ok: true,
    write: 'insert',
    hide: {
      id: newId(),
      userId,
      postId,
      createdAt: now,
      updatedAt: now,
    },
  }
}

export function decideUnhidePost(
  current: PostHideRecord | null,
  userId: string,
  postId: string,
): UnhidePostMutationResult {
  const uid = userId.trim()
  const pid = postId.trim()
  if (!uid || !pid) return { ok: false, reason: 'invalid' }
  if (!current || current.userId !== uid || current.postId !== pid) {
    return { ok: false, reason: 'not_hidden' }
  }
  return { ok: true, removed: current }
}

/**
 * Mute a person. Friendship / follow / block rows are untouched. Unique
 * (muter, muted): second mute updates. Self mute refused.
 */
export function decideMute(
  current: MuteRecord | null,
  input: MuteInput,
  opts?: { now?: Date; newId?: () => string },
): MuteMutationResult {
  const muter = input.muterUserId.trim()
  const muted = input.mutedUserId.trim()
  if (!muter || !muted) return { ok: false, reason: 'invalid' }
  if (muter === muted) return { ok: false, reason: 'self' }
  if (isSocialBanned(input.actorBannedAt ?? null)) {
    return { ok: false, reason: 'banned' }
  }

  const now = opts?.now ?? new Date()
  const newId = opts?.newId ?? (() => crypto.randomUUID())

  if (
    current &&
    current.muterUserId === muter &&
    current.mutedUserId === muted
  ) {
    return {
      ok: true,
      write: 'update',
      mute: { ...current, updatedAt: now },
    }
  }

  return {
    ok: true,
    write: 'insert',
    mute: {
      id: newId(),
      muterUserId: muter,
      mutedUserId: muted,
      createdAt: now,
      updatedAt: now,
    },
  }
}

export function decideUnmute(
  current: MuteRecord | null,
  muterUserId: string,
  mutedUserId: string,
): UnmuteMutationResult {
  const muter = muterUserId.trim()
  const muted = mutedUserId.trim()
  if (!muter || !muted) return { ok: false, reason: 'invalid' }
  if (
    !current ||
    current.muterUserId !== muter ||
    current.mutedUserId !== muted
  ) {
    return { ok: false, reason: 'not_muted' }
  }
  return { ok: true, removed: current }
}

/**
 * Feed quiet cut: hidden posts and muted authors drop out before LIMIT.
 * Own posts are never muted out. Does not change canViewPost / permalink.
 */
export function matchesFeedQuietExclusion(
  post: PostRecord,
  viewerUserId: string | null,
  facts: {
    hiddenPostIds?: ReadonlySet<string>
    mutedAuthorIds?: ReadonlySet<string>
  },
): boolean {
  const viewer = viewerUserId?.trim() || null
  if (facts.hiddenPostIds?.has(post.id)) return true
  if (
    viewer &&
    post.authorUserId !== viewer &&
    facts.mutedAuthorIds?.has(post.authorUserId)
  ) {
    return true
  }
  return false
}

export type QuietBag = {
  hides: Map<string, PostHideRecord>
  mutes: Map<string, MuteRecord>
}

export function applyHidePost(
  bag: QuietBag,
  input: HidePostInput,
  gates: { canView: boolean },
  opts?: { now?: Date; newId?: () => string },
): HidePostMutationResult {
  const key = hidePairKey(input.userId, input.postId)
  const current = bag.hides.get(key) ?? null
  const decision = decideHidePost(current, input, gates, opts)
  if (!decision.ok) return decision
  bag.hides.set(hidePairKey(decision.hide.userId, decision.hide.postId), decision.hide)
  return decision
}

export function applyUnhidePost(
  bag: QuietBag,
  userId: string,
  postId: string,
): UnhidePostMutationResult {
  const key = hidePairKey(userId, postId)
  const current = bag.hides.get(key) ?? null
  const decision = decideUnhidePost(current, userId, postId)
  if (!decision.ok) return decision
  bag.hides.delete(key)
  return decision
}

export function applyMute(
  bag: QuietBag,
  input: MuteInput,
  opts?: { now?: Date; newId?: () => string },
): MuteMutationResult {
  const key = mutePairKey(input.muterUserId, input.mutedUserId)
  const current = bag.mutes.get(key) ?? null
  const decision = decideMute(current, input, opts)
  if (!decision.ok) return decision
  bag.mutes.set(
    mutePairKey(decision.mute.muterUserId, decision.mute.mutedUserId),
    decision.mute,
  )
  return decision
}

export function applyUnmute(
  bag: QuietBag,
  muterUserId: string,
  mutedUserId: string,
): UnmuteMutationResult {
  const key = mutePairKey(muterUserId, mutedUserId)
  const current = bag.mutes.get(key) ?? null
  const decision = decideUnmute(current, muterUserId, mutedUserId)
  if (!decision.ok) return decision
  bag.mutes.delete(key)
  return decision
}

export function listHiddenPostIds(bag: QuietBag, userId: string): Set<string> {
  const uid = userId.trim()
  const ids = new Set<string>()
  for (const row of bag.hides.values()) {
    if (row.userId === uid) ids.add(row.postId)
  }
  return ids
}

export function listMutedAuthorIds(bag: QuietBag, muterUserId: string): Set<string> {
  const muter = muterUserId.trim()
  const ids = new Set<string>()
  for (const row of bag.mutes.values()) {
    if (row.muterUserId === muter) ids.add(row.mutedUserId)
  }
  return ids
}

/** In-memory quiet bag for unit tests. */
export function createQuietMemory(opts?: {
  now?: () => Date
  newId?: () => string
}): {
  bag: QuietBag
  hidePost: (
    input: HidePostInput,
    gates: { canView: boolean },
  ) => HidePostMutationResult
  unhidePost: (userId: string, postId: string) => UnhidePostMutationResult
  mute: (input: MuteInput) => MuteMutationResult
  unmute: (muterUserId: string, mutedUserId: string) => UnmuteMutationResult
  listHiddenPostIds: (userId: string) => Set<string>
  listMutedAuthorIds: (muterUserId: string) => Set<string>
  getHide: (userId: string, postId: string) => PostHideRecord | null
  getMute: (muterUserId: string, mutedUserId: string) => MuteRecord | null
} {
  const bag: QuietBag = { hides: new Map(), mutes: new Map() }
  const now = opts?.now ?? (() => new Date())
  const newId = opts?.newId ?? (() => crypto.randomUUID())

  return {
    bag,
    hidePost: (input, gates) =>
      applyHidePost(bag, input, gates, { now: now(), newId }),
    unhidePost: (userId, postId) => applyUnhidePost(bag, userId, postId),
    mute: (input) => applyMute(bag, input, { now: now(), newId }),
    unmute: (muterUserId, mutedUserId) =>
      applyUnmute(bag, muterUserId, mutedUserId),
    listHiddenPostIds: (userId) => listHiddenPostIds(bag, userId),
    listMutedAuthorIds: (muterUserId) => listMutedAuthorIds(bag, muterUserId),
    getHide: (userId, postId) =>
      bag.hides.get(hidePairKey(userId, postId)) ?? null,
    getMute: (muterUserId, mutedUserId) =>
      bag.mutes.get(mutePairKey(muterUserId, mutedUserId)) ?? null,
  }
}
