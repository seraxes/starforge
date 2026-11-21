/**
 * product:social mentions / hashtags / saves persistence.
 *
 * Save requires canViewPost. Unique (userId, postId): concurrent second insert
 * updates the open row. Tag and saved feeds filter with canViewPost then LIMIT.
 * Mentions resolve @handles through Profiles; notify skips canInteract failures.
 */

import 'server-only'

import { and, desc, eq, inArray } from 'drizzle-orm'

import type { AccessViewer } from '@/core/acl'
import { db } from '@/core/db'
import { getPersonaByHandle } from '@/modules/profiles/api.server'

import { areBlocked } from './friends-store'
import type { CanInteractContext } from './interact'
import { getMemberBannedAt, isMemberAccountHidden } from './members-store'
import {
  buildMentionRows,
  buildPostTagRows,
  decideMentionNotifications,
  decideSave,
  decideUnsave,
  extractHashtags,
  extractMentionHandles,
  normalizeTag,
  type MentionRecord,
  type PostTagRecord,
  type ResolvedMention,
  type SaveMutationResult,
  type SaveRecord,
  type UnsaveMutationResult,
} from './mentions-tags-saves'
import { toPostRecord, type PostRecord } from './posts'
import {
  canViewerSeePost,
  findPost,
  hydratePostsMedia,
} from './posts-store'
import {
  sfSocialMentions,
  sfSocialPostTags,
  sfSocialPosts,
  sfSocialSaves,
} from './schema'

function mapSave(row: typeof sfSocialSaves.$inferSelect): SaveRecord {
  return {
    id: row.id,
    userId: row.userId,
    postId: row.postId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function authorAsViewer(authorUserId: string): AccessViewer {
  return {
    userId: authorUserId,
    isRegistered: true,
    isAppAdmin: false,
    groupIds: [],
  }
}

export async function findSave(
  userId: string,
  postId: string,
): Promise<SaveRecord | null> {
  const uid = userId.trim()
  const pid = postId.trim()
  if (!uid || !pid) return null
  try {
    const [row] = await db
      .select()
      .from(sfSocialSaves)
      .where(and(eq(sfSocialSaves.userId, uid), eq(sfSocialSaves.postId, pid)))
      .limit(1)
    return row ? mapSave(row) : null
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_saves|does not exist|relation/i.test(msg)) return null
    throw error
  }
}

async function interactAgainst(
  actorUserId: string,
  otherUserId: string,
): Promise<CanInteractContext> {
  const [blocked, actorHidden, otherHidden, actorBannedAt, otherBannedAt] =
    await Promise.all([
      areBlocked(actorUserId, otherUserId),
      isMemberAccountHidden(actorUserId),
      isMemberAccountHidden(otherUserId),
      getMemberBannedAt(actorUserId),
      getMemberBannedAt(otherUserId),
    ])
  return {
    isBlocked: blocked,
    actorHidden,
    otherHidden,
    actorBannedAt,
    otherBannedAt,
  }
}

/** Save a post. Refused when canViewPost denies (cannot_view). */
export async function savePost(input: {
  userId: string
  postId: string
}): Promise<SaveMutationResult> {
  const userId = input.userId.trim()
  const postId = input.postId.trim()
  const post = await findPost(postId)
  const canView = post ? await canViewerSeePost(userId, post) : false
  const actorBannedAt = userId ? await getMemberBannedAt(userId) : null
  const current = await findSave(userId, postId)
  const decision = decideSave(
    current,
    { userId, postId, actorBannedAt },
    { canView },
  )
  if (!decision.ok) return decision

  try {
    if (decision.write === 'update' && current) {
      await db
        .update(sfSocialSaves)
        .set({ updatedAt: decision.save.updatedAt })
        .where(eq(sfSocialSaves.id, current.id))
    } else {
      try {
        await db.insert(sfSocialSaves).values({
          id: decision.save.id,
          userId: decision.save.userId,
          postId: decision.save.postId,
          createdAt: decision.save.createdAt,
          updatedAt: decision.save.updatedAt,
        })
      } catch (error) {
        // Unique (userId, postId): concurrent second insert → update open row.
        const msg = error instanceof Error ? error.message : String(error)
        if (!/unique|duplicate/i.test(msg)) throw error
        const existing = await findSave(userId, postId)
        if (!existing) throw error
        await db
          .update(sfSocialSaves)
          .set({ updatedAt: decision.save.updatedAt })
          .where(eq(sfSocialSaves.id, existing.id))
        return {
          ok: true,
          write: 'update',
          save: { ...existing, updatedAt: decision.save.updatedAt },
        }
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_saves|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'invalid' }
    }
    throw error
  }

  return decision
}

export async function unsavePost(
  userId: string,
  postId: string,
): Promise<UnsaveMutationResult> {
  const current = await findSave(userId, postId)
  const decision = decideUnsave(current, userId, postId)
  if (!decision.ok) return decision
  try {
    await db.delete(sfSocialSaves).where(eq(sfSocialSaves.id, decision.removed.id))
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_saves|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'invalid' }
    }
    throw error
  }
  return decision
}

/**
 * Replace hashtag rows for a post from its body. Called after create / edit.
 */
export async function syncPostTagsFromBody(
  postId: string,
  body: string,
): Promise<PostTagRecord[]> {
  const pid = postId.trim()
  if (!pid) return []
  const tags = extractHashtags(body)
  const rows = buildPostTagRows(pid, tags)
  try {
    await db.transaction(async (tx) => {
      await tx.delete(sfSocialPostTags).where(eq(sfSocialPostTags.postId, pid))
      if (rows.length > 0) {
        await tx.insert(sfSocialPostTags).values(
          rows.map((row) => ({
            id: row.id,
            postId: row.postId,
            tag: row.tag,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          })),
        )
      }
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_post_tags|does not exist|relation/i.test(msg)) return []
    throw error
  }
  return rows
}

/**
 * Resolve @handles via Profiles, replace mention rows, notify when canInteract.
 * Soft-fail on notify so the post write is not rolled back.
 * A blocked member is not notified.
 */
export async function syncPostMentionsFromBody(
  postId: string,
  authorUserId: string,
  body: string,
  opts?: { onNotify?: (userId: string) => void | Promise<void> },
): Promise<{ mentions: MentionRecord[]; notifyUserIds: string[] }> {
  const pid = postId.trim()
  const author = authorUserId.trim()
  if (!pid || !author) return { mentions: [], notifyUserIds: [] }

  const handles = extractMentionHandles(body)
  const viewer = authorAsViewer(author)
  const resolved: ResolvedMention[] = []
  for (const handle of handles) {
    try {
      const hit = await getPersonaByHandle(handle, viewer)
      const userId = hit?.record.userId?.trim()
      if (!userId) continue
      resolved.push({
        userId,
        handle: hit.persona.handle?.trim().toLowerCase() || handle,
      })
    } catch {
      // Soft-skip unknown / Profiles failures.
    }
  }

  const rows = buildMentionRows(pid, resolved)
  try {
    await db.transaction(async (tx) => {
      await tx.delete(sfSocialMentions).where(eq(sfSocialMentions.postId, pid))
      if (rows.length > 0) {
        await tx.insert(sfSocialMentions).values(
          rows.map((row) => ({
            id: row.id,
            postId: row.postId,
            mentionedUserId: row.mentionedUserId,
            handle: row.handle,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          })),
        )
      }
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_mentions|does not exist|relation/i.test(msg)) {
      return { mentions: [], notifyUserIds: [] }
    }
    throw error
  }

  const interactCache = new Map<string, CanInteractContext>()
  for (const m of resolved) {
    interactCache.set(m.userId, await interactAgainst(author, m.userId))
  }
  const notifyDecision = decideMentionNotifications(
    author,
    resolved,
    (mentionedUserId) =>
      interactCache.get(mentionedUserId) ?? {
        isBlocked: false,
        actorHidden: false,
        otherHidden: false,
        actorBannedAt: null,
        otherBannedAt: null,
      },
  )

  for (const userId of notifyDecision.notifyUserIds) {
    try {
      await opts?.onNotify?.(userId)
    } catch {
      // Soft-fail — mention write must not depend on notify.
    }
  }

  return { mentions: rows, notifyUserIds: notifyDecision.notifyUserIds }
}

/** After create/edit: sync tags + mentions from body. Soft-fails individually. */
export async function syncPostMentionsAndTags(
  postId: string,
  authorUserId: string,
  body: string,
): Promise<void> {
  const { loadSocialModuleSettings } = await import('./settings')
  const pack = await loadSocialModuleSettings()
  if (pack.settings.allowHashtags) {
    await syncPostTagsFromBody(postId, body)
  }
  if (pack.settings.allowMentions) {
    await syncPostMentionsFromBody(postId, authorUserId, body)
  }
}

/**
 * Tag feed: posts with this hashtag the viewer may read.
 * Loads by tag, then canViewPost per row until the page is full.
 */
export async function listTagFeedPosts(
  viewerUserId: string | null,
  tag: string,
  opts?: { limit?: number },
): Promise<PostRecord[]> {
  const normalized = normalizeTag(tag)
  if (!normalized) return []
  const capped = Math.min(Math.max(1, Math.floor(opts?.limit ?? 50)), 100)

  try {
    const tagRows = await db
      .select({ postId: sfSocialPostTags.postId })
      .from(sfSocialPostTags)
      .where(eq(sfSocialPostTags.tag, normalized))
    const postIds = [...new Set(tagRows.map((r) => r.postId))]
    if (postIds.length === 0) return []

    const rows = await db
      .select()
      .from(sfSocialPosts)
      .where(inArray(sfSocialPosts.id, postIds))
      .orderBy(desc(sfSocialPosts.createdAt))
      .limit(capped * 3)

    const posts = rows
      .map((row) => toPostRecord(row))
      .filter((p): p is PostRecord => Boolean(p))
    const hydrated = await hydratePostsMedia(posts)

    const visible: PostRecord[] = []
    for (const post of hydrated) {
      if (await canViewerSeePost(viewerUserId, post)) {
        visible.push(post)
        if (visible.length >= capped) break
      }
    }
    return visible
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_|does not exist|relation/i.test(msg)) return []
    throw error
  }
}

/**
 * Saved feed: posts this member saved and may still read.
 */
export async function listSavedFeedPosts(
  userId: string,
  opts?: { limit?: number },
): Promise<PostRecord[]> {
  const viewer = userId.trim()
  if (!viewer) return []
  const capped = Math.min(Math.max(1, Math.floor(opts?.limit ?? 50)), 100)

  try {
    const saveRows = await db
      .select()
      .from(sfSocialSaves)
      .where(eq(sfSocialSaves.userId, viewer))
      .orderBy(desc(sfSocialSaves.createdAt))
      .limit(capped * 3)

    const postIds = saveRows.map((r) => r.postId)
    if (postIds.length === 0) return []

    const rows = await db
      .select()
      .from(sfSocialPosts)
      .where(inArray(sfSocialPosts.id, postIds))

    const byId = new Map(
      rows
        .map((row) => toPostRecord(row))
        .filter((p): p is PostRecord => Boolean(p))
        .map((p) => [p.id, p]),
    )
    const ordered: PostRecord[] = []
    for (const save of saveRows) {
      const post = byId.get(save.postId)
      if (post) ordered.push(post)
    }
    const hydrated = await hydratePostsMedia(ordered)

    const visible: PostRecord[] = []
    for (const post of hydrated) {
      if (await canViewerSeePost(viewer, post)) {
        visible.push(post)
        if (visible.length >= capped) break
      }
    }
    return visible
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_|does not exist|relation/i.test(msg)) return []
    throw error
  }
}
