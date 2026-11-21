/**
 * product:social mentions, hashtags, and saves (slice 20).
 *
 * Mentions are @handle resolved through Profiles. Notify calls canInteract —
 * a blocked member is not notified. Hashtags are a string list on the post
 * (sf_social_post_tags); /feed/tag/[tag] uses canViewPost. Saves are
 * sf_social_saves (unique userId+postId); /feed/saved uses canViewPost.
 * Saving a post the viewer cannot see is refused.
 */

import { canInteract, isSocialBanned, type CanInteractContext } from './interact'
import {
  canViewPost,
  type CanViewPostContext,
  type PostRecord,
} from './posts'
import { paginateFeedPosts } from './feed'

/** Max distinct hashtags stored per post. */
export const POST_TAG_MAX = 20

/** Max distinct @mentions stored per post. */
export const POST_MENTION_MAX = 20

export type SaveRecord = {
  id: string
  userId: string
  postId: string
  createdAt: Date
  updatedAt: Date
}

export type PostTagRecord = {
  id: string
  postId: string
  /** Normalized lowercase tag without leading #. */
  tag: string
  createdAt: Date
  updatedAt: Date
}

export type MentionRecord = {
  id: string
  postId: string
  /** Resolved Profiles user id (plain text). */
  mentionedUserId: string
  /** Handle snapshot at write time. */
  handle: string
  createdAt: Date
  updatedAt: Date
}

export type SaveRefuseReason =
  | 'invalid'
  | 'cannot_view'
  | 'banned'
  | 'not_saved'

export type SaveMutationResult =
  | { ok: true; save: SaveRecord; write: 'insert' | 'update' }
  | { ok: false; reason: SaveRefuseReason }

export type UnsaveMutationResult =
  | { ok: true; removed: SaveRecord }
  | { ok: false; reason: SaveRefuseReason }

export type MentionNotifySkipReason = 'blocked' | 'cannot_interact' | 'banned' | 'self'

export type MentionNotifyDecision = {
  /** Members who should receive a mention notification. */
  notifyUserIds: string[]
  /** Resolved mentions that were not notified (still may be stored). */
  skipped: Array<{ userId: string; reason: MentionNotifySkipReason }>
}

export type ResolvedMention = {
  userId: string
  handle: string
}

export type SaveInput = {
  userId: string
  postId: string
  /** Author Social bannedAt for the saver — refuse when set. */
  actorBannedAt?: Date | null
}

export function savePairKey(userId: string, postId: string): string {
  return `${userId.trim()}\0${postId.trim()}`
}

export function tagPairKey(postId: string, tag: string): string {
  return `${postId.trim()}\0${normalizeTag(tag)}`
}

export function mentionPairKey(postId: string, mentionedUserId: string): string {
  return `${postId.trim()}\0${mentionedUserId.trim()}`
}

/**
 * Normalize a hashtag token: strip leading #, lowercase, keep [a-z0-9_].
 * Empty after normalize → invalid.
 */
export function normalizeTag(raw: string): string {
  let s = raw.trim()
  if (s.startsWith('#')) s = s.slice(1)
  s = s.toLowerCase()
  s = s.replace(/[^a-z0-9_]/g, '')
  return s
}

/** Extract distinct normalized hashtags from post body (plain or HTML). */
export function extractHashtags(body: string): string[] {
  const text = stripHtmlForParse(body)
  const found: string[] = []
  const seen = new Set<string>()
  for (const match of text.matchAll(/(^|[^a-zA-Z0-9_])#([a-zA-Z0-9_]{1,64})/g)) {
    const tag = normalizeTag(match[2] ?? '')
    if (!tag || seen.has(tag)) continue
    seen.add(tag)
    found.push(tag)
    if (found.length >= POST_TAG_MAX) break
  }
  return found
}

/** Extract distinct @handles from post body (plain or HTML). Lowercased. */
export function extractMentionHandles(body: string): string[] {
  const text = stripHtmlForParse(body)
  const found: string[] = []
  const seen = new Set<string>()
  for (const match of text.matchAll(/(^|[^a-zA-Z0-9_])@([a-zA-Z0-9_]{1,64})/g)) {
    const handle = (match[2] ?? '').trim().toLowerCase()
    if (!handle || seen.has(handle)) continue
    seen.add(handle)
    found.push(handle)
    if (found.length >= POST_MENTION_MAX) break
  }
  return found
}

function stripHtmlForParse(body: string): string {
  return body
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
}

/**
 * Save a post the viewer can see. Unique (userId, postId): second save updates.
 * Named failure: cannot_view when canViewPost denies.
 */
export function decideSave(
  current: SaveRecord | null,
  input: SaveInput,
  gates: { canView: boolean },
  opts?: { now?: Date; newId?: () => string },
): SaveMutationResult {
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
      save: { ...current, updatedAt: now },
    }
  }

  return {
    ok: true,
    write: 'insert',
    save: {
      id: newId(),
      userId,
      postId,
      createdAt: now,
      updatedAt: now,
    },
  }
}

export function decideUnsave(
  current: SaveRecord | null,
  userId: string,
  postId: string,
): UnsaveMutationResult {
  const uid = userId.trim()
  const pid = postId.trim()
  if (!uid || !pid) return { ok: false, reason: 'invalid' }
  if (!current || current.userId !== uid || current.postId !== pid) {
    return { ok: false, reason: 'not_saved' }
  }
  return { ok: true, removed: current }
}

/**
 * Who to notify for @mentions. Calls canInteract(author, mentioned) —
 * does not re-derive the block rule. A blocked member is skipped.
 */
export function decideMentionNotifications(
  authorUserId: string,
  mentions: readonly ResolvedMention[],
  interactFor: (mentionedUserId: string) => CanInteractContext,
): MentionNotifyDecision {
  const author = authorUserId.trim()
  const notifyUserIds: string[] = []
  const skipped: MentionNotifyDecision['skipped'] = []
  const seen = new Set<string>()

  for (const row of mentions) {
    const userId = row.userId.trim()
    if (!userId || seen.has(userId)) continue
    seen.add(userId)

    if (!author || userId === author) {
      skipped.push({ userId, reason: 'self' })
      continue
    }

    const ctx = interactFor(userId)
    if (isSocialBanned(ctx.actorBannedAt) || isSocialBanned(ctx.otherBannedAt)) {
      skipped.push({ userId, reason: 'banned' })
      continue
    }
    if (!canInteract(author, userId, ctx)) {
      skipped.push({
        userId,
        reason: ctx.isBlocked ? 'blocked' : 'cannot_interact',
      })
      continue
    }
    notifyUserIds.push(userId)
  }

  return { notifyUserIds, skipped }
}

/** Build tag rows for a post from extracted / provided tags (unique per post). */
export function buildPostTagRows(
  postId: string,
  tags: readonly string[],
  opts?: { now?: Date; newId?: () => string },
): PostTagRecord[] {
  const pid = postId.trim()
  if (!pid) return []
  const now = opts?.now ?? new Date()
  const newId = opts?.newId ?? (() => crypto.randomUUID())
  const rows: PostTagRecord[] = []
  const seen = new Set<string>()
  for (const raw of tags) {
    const tag = normalizeTag(raw)
    if (!tag || seen.has(tag)) continue
    seen.add(tag)
    rows.push({
      id: newId(),
      postId: pid,
      tag,
      createdAt: now,
      updatedAt: now,
    })
    if (rows.length >= POST_TAG_MAX) break
  }
  return rows
}

/** Build mention rows for a post (unique per mentioned user). */
export function buildMentionRows(
  postId: string,
  mentions: readonly ResolvedMention[],
  opts?: { now?: Date; newId?: () => string },
): MentionRecord[] {
  const pid = postId.trim()
  if (!pid) return []
  const now = opts?.now ?? new Date()
  const newId = opts?.newId ?? (() => crypto.randomUUID())
  const rows: MentionRecord[] = []
  const seen = new Set<string>()
  for (const m of mentions) {
    const userId = m.userId.trim()
    const handle = m.handle.trim().toLowerCase()
    if (!userId || !handle || seen.has(userId)) continue
    seen.add(userId)
    rows.push({
      id: newId(),
      postId: pid,
      mentionedUserId: userId,
      handle,
      createdAt: now,
      updatedAt: now,
    })
    if (rows.length >= POST_MENTION_MAX) break
  }
  return rows
}

/**
 * Tag feed: posts carrying this tag that the viewer may read.
 * Filter with canViewPost, then paginate (no short page from drop-in-memory).
 */
export function selectTagFeedPage(
  postsNewestFirst: readonly PostRecord[],
  tag: string,
  postIdsWithTag: ReadonlySet<string>,
  ctxForPost: (post: PostRecord) => CanViewPostContext,
  limit: number,
): PostRecord[] {
  const normalized = normalizeTag(tag)
  if (!normalized) return []
  const visible = postsNewestFirst.filter((post) => {
    if (!postIdsWithTag.has(post.id)) return false
    return canViewPost(post, ctxForPost(post))
  })
  return paginateFeedPosts(visible, limit)
}

/**
 * Saved feed: posts the viewer saved and may still read.
 * Drop saves whose post fails canViewPost.
 */
export function selectSavedFeedPage(
  postsNewestFirst: readonly PostRecord[],
  savedPostIds: ReadonlySet<string>,
  ctxForPost: (post: PostRecord) => CanViewPostContext,
  limit: number,
): PostRecord[] {
  const visible = postsNewestFirst.filter((post) => {
    if (!savedPostIds.has(post.id)) return false
    return canViewPost(post, ctxForPost(post))
  })
  return paginateFeedPosts(visible, limit)
}

export type MentionsTagsSavesBag = {
  saves: Map<string, SaveRecord>
  tags: Map<string, PostTagRecord>
  mentions: Map<string, MentionRecord>
}

export function applySave(
  bag: MentionsTagsSavesBag,
  input: SaveInput,
  gates: { canView: boolean },
  opts?: { now?: Date; newId?: () => string },
): SaveMutationResult {
  const key = savePairKey(input.userId, input.postId)
  const current = bag.saves.get(key) ?? null
  const decision = decideSave(current, input, gates, opts)
  if (!decision.ok) return decision
  bag.saves.set(savePairKey(decision.save.userId, decision.save.postId), decision.save)
  return decision
}

export function applyUnsave(
  bag: MentionsTagsSavesBag,
  userId: string,
  postId: string,
): UnsaveMutationResult {
  const key = savePairKey(userId, postId)
  const current = bag.saves.get(key) ?? null
  const decision = decideUnsave(current, userId, postId)
  if (!decision.ok) return decision
  bag.saves.delete(key)
  return decision
}

export function replacePostTags(
  bag: MentionsTagsSavesBag,
  postId: string,
  tags: readonly string[],
  opts?: { now?: Date; newId?: () => string },
): PostTagRecord[] {
  const pid = postId.trim()
  for (const [key, row] of bag.tags) {
    if (row.postId === pid) bag.tags.delete(key)
  }
  const rows = buildPostTagRows(pid, tags, opts)
  for (const row of rows) {
    bag.tags.set(tagPairKey(row.postId, row.tag), row)
  }
  return rows
}

export function replacePostMentions(
  bag: MentionsTagsSavesBag,
  postId: string,
  mentions: readonly ResolvedMention[],
  opts?: { now?: Date; newId?: () => string },
): MentionRecord[] {
  const pid = postId.trim()
  for (const [key, row] of bag.mentions) {
    if (row.postId === pid) bag.mentions.delete(key)
  }
  const rows = buildMentionRows(pid, mentions, opts)
  for (const row of rows) {
    bag.mentions.set(mentionPairKey(row.postId, row.mentionedUserId), row)
  }
  return rows
}

export function listPostIdsForTag(
  bag: MentionsTagsSavesBag,
  tag: string,
): Set<string> {
  const normalized = normalizeTag(tag)
  const ids = new Set<string>()
  if (!normalized) return ids
  for (const row of bag.tags.values()) {
    if (row.tag === normalized) ids.add(row.postId)
  }
  return ids
}

export function listSavedPostIds(
  bag: MentionsTagsSavesBag,
  userId: string,
): Set<string> {
  const uid = userId.trim()
  const ids = new Set<string>()
  for (const row of bag.saves.values()) {
    if (row.userId === uid) ids.add(row.postId)
  }
  return ids
}

/** In-memory mentions / tags / saves for unit tests. */
export function createMentionsTagsSavesMemory(opts?: {
  now?: () => Date
  newId?: () => string
}): {
  bag: MentionsTagsSavesBag
  save: (
    input: SaveInput,
    gates: { canView: boolean },
  ) => SaveMutationResult
  unsave: (userId: string, postId: string) => UnsaveMutationResult
  setTags: (postId: string, tags: readonly string[]) => PostTagRecord[]
  setMentions: (
    postId: string,
    mentions: readonly ResolvedMention[],
  ) => MentionRecord[]
  notifyMentions: (
    authorUserId: string,
    mentions: readonly ResolvedMention[],
    interactFor: (mentionedUserId: string) => CanInteractContext,
    onNotify?: (userId: string) => void,
  ) => MentionNotifyDecision
  tagFeed: (
    posts: readonly PostRecord[],
    tag: string,
    ctxForPost: (post: PostRecord) => CanViewPostContext,
    limit?: number,
  ) => PostRecord[]
  savedFeed: (
    posts: readonly PostRecord[],
    userId: string,
    ctxForPost: (post: PostRecord) => CanViewPostContext,
    limit?: number,
  ) => PostRecord[]
  getSave: (userId: string, postId: string) => SaveRecord | null
} {
  const bag: MentionsTagsSavesBag = {
    saves: new Map(),
    tags: new Map(),
    mentions: new Map(),
  }
  const now = opts?.now ?? (() => new Date())
  const newId = opts?.newId ?? (() => crypto.randomUUID())

  return {
    bag,
    save: (input, gates) =>
      applySave(bag, input, gates, { now: now(), newId }),
    unsave: (userId, postId) => applyUnsave(bag, userId, postId),
    setTags: (postId, tags) =>
      replacePostTags(bag, postId, tags, { now: now(), newId }),
    setMentions: (postId, mentions) =>
      replacePostMentions(bag, postId, mentions, { now: now(), newId }),
    notifyMentions: (authorUserId, mentions, interactFor, onNotify) => {
      const decision = decideMentionNotifications(
        authorUserId,
        mentions,
        interactFor,
      )
      for (const userId of decision.notifyUserIds) {
        onNotify?.(userId)
      }
      return decision
    },
    tagFeed: (posts, tag, ctxForPost, limit = 50) =>
      selectTagFeedPage(posts, tag, listPostIdsForTag(bag, tag), ctxForPost, limit),
    savedFeed: (posts, userId, ctxForPost, limit = 50) =>
      selectSavedFeedPage(posts, listSavedPostIds(bag, userId), ctxForPost, limit),
    getSave: (userId, postId) =>
      bag.saves.get(savePairKey(userId, postId)) ?? null,
  }
}
