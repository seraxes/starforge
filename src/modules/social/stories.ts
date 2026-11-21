/**
 * product:social stories — 24h media, seen/unseen, author viewer list.
 *
 * Visibility hides expired rows (expiresAt / expiredAt). Recording a view and
 * the author viewer list call canInteract — they do not re-derive the block rule.
 * Files stay in product:media; Social only stores mediaId. social.sweep marks
 * expiry on this same job (no second runner).
 */

import { canInteract, isSocialBanned, type CanInteractContext } from './interact'
import { classifyMediaMime, type MediaResolveResult } from './posts'

/** Story lifetime from create. */
export const STORY_TTL_MS = 24 * 60 * 60 * 1000

export type StoryRecord = {
  id: string
  authorUserId: string
  mediaId: string
  mimeType: string | null
  expiresAt: Date
  expiredAt: Date | null
  extensions: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export type StoryViewRecord = {
  id: string
  storyId: string
  userId: string
  createdAt: Date
  updatedAt: Date
}

export type StoryRefuseReason =
  | 'invalid'
  | 'not_found'
  | 'banned'
  | 'blocked'
  | 'cannot_interact'
  | 'unknown_media'
  | 'invalid_media'
  | 'expired'
  | 'cannot_view'
  | 'disabled'

export type StoryMutationResult =
  | { ok: true; story: StoryRecord }
  | { ok: false; reason: StoryRefuseReason }

export type StoryViewMutationResult =
  | { ok: true; view: StoryViewRecord; write: 'insert' | 'update' }
  | { ok: false; reason: StoryRefuseReason }

export type CreateStoryInput = {
  authorUserId: string
  mediaId: string
  authorBannedAt?: Date | null
  extensions?: Record<string, unknown>
}

export type RecordStoryViewInput = {
  storyId: string
  userId: string
  interact: CanInteractContext
}

/** createdAt + lifetime. Default is 24 hours (`STORY_TTL_MS`). */
export function computeStoryExpiresAt(createdAt: Date, lifetimeMs: number = STORY_TTL_MS): Date {
  const ms = lifetimeMs > 0 ? lifetimeMs : STORY_TTL_MS
  return new Date(createdAt.getTime() + ms)
}

/** True when sweep already marked it, or the clock has passed expiresAt. */
export function isStoryExpired(story: StoryRecord, now: Date): boolean {
  if (story.expiredAt != null) return true
  return now.getTime() >= story.expiresAt.getTime()
}

/**
 * Read check for one story. Author always sees their own while it is active.
 * Others need canInteract with the author. Expired stories are hidden for everyone.
 */
export function canViewStory(
  viewerUserId: string,
  story: StoryRecord,
  ctx: {
    now: Date
    interact: CanInteractContext
  },
): boolean {
  if (isStoryExpired(story, ctx.now)) return false
  const viewer = viewerUserId.trim()
  const author = story.authorUserId.trim()
  if (!viewer || !author) return false
  if (viewer === author) return true
  return canInteract(viewer, author, ctx.interact)
}

/** Seen when a view row exists for this viewer + story. */
export function hasSeenStory(
  views: readonly StoryViewRecord[],
  userId: string,
  storyId: string,
): boolean {
  const uid = userId.trim()
  const sid = storyId.trim()
  if (!uid || !sid) return false
  return views.some((row) => row.userId === uid && row.storyId === sid)
}

/**
 * Active stories only (not expired). Used by /feed/stories and social-stories.
 */
export function selectActiveStories(
  stories: readonly StoryRecord[],
  now: Date,
): StoryRecord[] {
  return stories
    .filter((row) => !isStoryExpired(row, now))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

/**
 * Author viewer list. Omits the author and anyone who fails canInteract
 * (blocked / hidden / banned). Does not re-derive the block rule.
 */
export function listStoryViewerIds(
  story: StoryRecord,
  views: readonly StoryViewRecord[],
  resolveInteract: (viewerUserId: string) => CanInteractContext,
): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const view of views) {
    if (view.storyId !== story.id) continue
    const viewer = view.userId.trim()
    if (!viewer || viewer === story.authorUserId) continue
    if (seen.has(viewer)) continue
    const interact = resolveInteract(viewer)
    if (!canInteract(viewer, story.authorUserId, interact)) continue
    seen.add(viewer)
    out.push(viewer)
  }
  return out
}

export function decideCreateStory(
  input: CreateStoryInput,
  opts?: {
    now?: Date
    newId?: () => string
    resolveMedia?: (mediaId: string) => MediaResolveResult | null
    /** Pack story lifetime. Omitted → 24 hours. */
    lifetimeMs?: number
    /** Pack allowStories switch. false → disabled. */
    storiesEnabled?: boolean
  },
): StoryMutationResult {
  const authorUserId = input.authorUserId.trim()
  const mediaId = input.mediaId.trim()
  if (!authorUserId || !mediaId) return { ok: false, reason: 'invalid' }
  if (opts?.storiesEnabled === false) return { ok: false, reason: 'disabled' }
  if (isSocialBanned(input.authorBannedAt ?? null)) {
    return { ok: false, reason: 'banned' }
  }

  const resolveMedia = opts?.resolveMedia
  if (!resolveMedia) return { ok: false, reason: 'unknown_media' }
  const media = resolveMedia(mediaId)
  if (!media) return { ok: false, reason: 'unknown_media' }
  const kind = classifyMediaMime(media.mimeType)
  if (kind !== 'image' && kind !== 'video') {
    return { ok: false, reason: 'invalid_media' }
  }

  const now = opts?.now ?? new Date()
  const newId = opts?.newId ?? (() => crypto.randomUUID())
  const story: StoryRecord = {
    id: newId(),
    authorUserId,
    mediaId: media.mediaId,
    mimeType: media.mimeType,
    expiresAt: computeStoryExpiresAt(now, opts?.lifetimeMs),
    expiredAt: null,
    extensions: input.extensions ?? {},
    createdAt: now,
    updatedAt: now,
  }
  return { ok: true, story }
}

/**
 * Record a view. Calls canInteract with the author. Unique (userId, storyId):
 * a second view updates that row. Expired / cannot-view refuse.
 */
export function decideRecordStoryView(
  story: StoryRecord | null,
  current: StoryViewRecord | null,
  input: RecordStoryViewInput,
  opts?: { now?: Date; newId?: () => string },
): StoryViewMutationResult {
  if (!story) return { ok: false, reason: 'not_found' }
  const userId = input.userId.trim()
  if (!userId || story.id.trim() !== input.storyId.trim()) {
    return { ok: false, reason: 'invalid' }
  }

  const now = opts?.now ?? new Date()
  if (isStoryExpired(story, now)) return { ok: false, reason: 'expired' }

  if (userId !== story.authorUserId) {
    if (
      isSocialBanned(input.interact.actorBannedAt) ||
      isSocialBanned(input.interact.otherBannedAt)
    ) {
      return { ok: false, reason: 'banned' }
    }
    if (!canInteract(userId, story.authorUserId, input.interact)) {
      if (input.interact.isBlocked) return { ok: false, reason: 'blocked' }
      return { ok: false, reason: 'cannot_interact' }
    }
    if (!canViewStory(userId, story, { now, interact: input.interact })) {
      return { ok: false, reason: 'cannot_view' }
    }
  }

  const newId = opts?.newId ?? (() => crypto.randomUUID())
  if (current && current.storyId === story.id && current.userId === userId) {
    return {
      ok: true,
      write: 'update',
      view: { ...current, updatedAt: now },
    }
  }

  return {
    ok: true,
    write: 'insert',
    view: {
      id: newId(),
      storyId: story.id,
      userId,
      createdAt: now,
      updatedAt: now,
    },
  }
}

export type StorySweepDecision = {
  expireIds: string[]
  expiredAt: Date
}

/**
 * Story handler for social.sweep: mark rows past expiresAt.
 * Does not delete the Media file.
 */
export function decideStorySweep(
  stories: readonly StoryRecord[],
  now: Date,
): StorySweepDecision {
  const expireIds: string[] = []
  for (const story of stories) {
    if (story.expiredAt != null) continue
    if (now.getTime() < story.expiresAt.getTime()) continue
    expireIds.push(story.id)
  }
  return { expireIds, expiredAt: now }
}

export type StoryBag = {
  stories: Map<string, StoryRecord>
  views: Map<string, StoryViewRecord>
}

function viewKey(storyId: string, userId: string): string {
  return `${storyId}\0${userId}`
}

export function applyCreateStory(
  bag: StoryBag,
  input: CreateStoryInput,
  opts?: {
    now?: Date
    newId?: () => string
    resolveMedia?: (mediaId: string) => MediaResolveResult | null
  },
): StoryMutationResult {
  const decision = decideCreateStory(input, opts)
  if (!decision.ok) return decision
  bag.stories.set(decision.story.id, decision.story)
  return decision
}

export function applyRecordStoryView(
  bag: StoryBag,
  input: RecordStoryViewInput,
  opts?: { now?: Date; newId?: () => string },
): StoryViewMutationResult {
  const story = bag.stories.get(input.storyId.trim()) ?? null
  const current =
    bag.views.get(viewKey(input.storyId.trim(), input.userId.trim())) ?? null
  const decision = decideRecordStoryView(story, current, input, opts)
  if (!decision.ok) return decision
  bag.views.set(viewKey(decision.view.storyId, decision.view.userId), decision.view)
  return decision
}

export function applyStorySweep(bag: StoryBag, now: Date): StorySweepDecision {
  const decision = decideStorySweep([...bag.stories.values()], now)
  for (const id of decision.expireIds) {
    const story = bag.stories.get(id)
    if (!story) continue
    bag.stories.set(id, {
      ...story,
      expiredAt: decision.expiredAt,
      updatedAt: decision.expiredAt,
    })
  }
  return decision
}

/** In-memory stories for unit tests — same unique view rules as the DB. */
export function createStoryMemory(opts?: {
  now?: () => Date
  newId?: () => string
  resolveMedia?: (mediaId: string) => MediaResolveResult | null
}): {
  bag: StoryBag
  create: (input: CreateStoryInput) => StoryMutationResult
  recordView: (input: RecordStoryViewInput) => StoryViewMutationResult
  sweep: (now?: Date) => StorySweepDecision
  getStory: (storyId: string) => StoryRecord | null
  getView: (storyId: string, userId: string) => StoryViewRecord | null
  listActive: (now?: Date) => StoryRecord[]
  listViewers: (
    storyId: string,
    resolveInteract: (viewerUserId: string) => CanInteractContext,
  ) => string[]
  canView: (
    viewerUserId: string,
    storyId: string,
    interact: CanInteractContext,
    now?: Date,
  ) => boolean
} {
  const bag: StoryBag = {
    stories: new Map(),
    views: new Map(),
  }
  const now = opts?.now ?? (() => new Date())
  const newId = opts?.newId ?? (() => crypto.randomUUID())
  const resolveMedia =
    opts?.resolveMedia ??
    ((mediaId: string) => ({
      mediaId: mediaId.trim(),
      mimeType: 'image/jpeg',
    }))

  return {
    bag,
    create: (input) =>
      applyCreateStory(bag, input, { now: now(), newId, resolveMedia }),
    recordView: (input) =>
      applyRecordStoryView(bag, input, { now: now(), newId }),
    sweep: (at) => applyStorySweep(bag, at ?? now()),
    getStory: (storyId) => bag.stories.get(storyId.trim()) ?? null,
    getView: (storyId, userId) =>
      bag.views.get(viewKey(storyId.trim(), userId.trim())) ?? null,
    listActive: (at) => selectActiveStories([...bag.stories.values()], at ?? now()),
    listViewers: (storyId, resolveInteract) => {
      const story = bag.stories.get(storyId.trim())
      if (!story) return []
      return listStoryViewerIds(story, [...bag.views.values()], resolveInteract)
    },
    canView: (viewerUserId, storyId, interact, at) => {
      const story = bag.stories.get(storyId.trim())
      if (!story) return false
      return canViewStory(viewerUserId, story, {
        now: at ?? now(),
        interact,
      })
    },
  }
}
