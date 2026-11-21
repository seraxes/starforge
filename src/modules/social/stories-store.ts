/**
 * product:social stories persistence — create, view, list, sweep expiry.
 * Media bytes stay in product:media; this pack only stores mediaId.
 */

import 'server-only'

import { and, desc, eq, gt, inArray, isNull, lte } from 'drizzle-orm'

import { db } from '@/core/db'
import { findMediaById, memberOwnsMedia } from '@/modules/media/api.server'

import { areBlocked } from './friends-store'
import type { CanInteractContext } from './interact'
import { getMemberBannedAt, isMemberAccountHidden } from './members-store'
import { storyLifetimeMs } from './pack-settings'
import { loadSocialModuleSettings } from './settings'
import {
  STORY_TTL_MS,
  decideCreateStory,
  decideRecordStoryView,
  decideStorySweep,
  isStoryExpired,
  listStoryViewerIds,
  selectActiveStories,
  type CreateStoryInput,
  type RecordStoryViewInput,
  type StoryMutationResult,
  type StoryRecord,
  type StoryRefuseReason,
  type StoryViewMutationResult,
  type StoryViewRecord,
} from './stories'
import { sfSocialStories, sfSocialStoryViews } from './schema'

export type StorySweepDbResult = {
  expired: number
}

function mapStory(row: typeof sfSocialStories.$inferSelect): StoryRecord {
  return {
    id: row.id,
    authorUserId: row.authorUserId,
    mediaId: row.mediaId,
    mimeType: row.mimeType,
    expiresAt: row.expiresAt,
    expiredAt: row.expiredAt,
    extensions: (row.extensions ?? {}) as Record<string, unknown>,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapView(row: typeof sfSocialStoryViews.$inferSelect): StoryViewRecord {
  return {
    id: row.id,
    storyId: row.storyId,
    userId: row.userId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

async function resolveMediaForAuthor(
  authorUserId: string,
  mediaId: string,
): Promise<{ mediaId: string; mimeType: string | null } | null> {
  if (!(await memberOwnsMedia(authorUserId, mediaId))) return null
  const doc = await findMediaById(mediaId)
  if (!doc) return null
  return { mediaId: doc.id, mimeType: doc.mimeType ?? null }
}

async function interactBetween(
  actorUserId: string,
  otherUserId: string,
): Promise<CanInteractContext> {
  const actor = actorUserId.trim()
  const other = otherUserId.trim()
  const [blocked, actorHidden, otherHidden, actorBannedAt, otherBannedAt] =
    await Promise.all([
      actor && other && actor !== other ? areBlocked(actor, other) : Promise.resolve(false),
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

export async function findStory(storyId: string): Promise<StoryRecord | null> {
  const id = storyId.trim()
  if (!id) return null
  try {
    const rows = await db
      .select()
      .from(sfSocialStories)
      .where(eq(sfSocialStories.id, id))
      .limit(1)
    const row = rows[0]
    return row ? mapStory(row) : null
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_stories|does not exist|relation/i.test(msg)) return null
    throw error
  }
}

export async function findStoryView(
  storyId: string,
  userId: string,
): Promise<StoryViewRecord | null> {
  const sid = storyId.trim()
  const uid = userId.trim()
  if (!sid || !uid) return null
  try {
    const rows = await db
      .select()
      .from(sfSocialStoryViews)
      .where(
        and(eq(sfSocialStoryViews.storyId, sid), eq(sfSocialStoryViews.userId, uid)),
      )
      .limit(1)
    const row = rows[0]
    return row ? mapView(row) : null
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_story_views|does not exist|relation/i.test(msg)) return null
    throw error
  }
}

export async function createStory(
  input: Omit<CreateStoryInput, 'authorBannedAt'> & { mediaId: string },
): Promise<StoryMutationResult> {
  const authorUserId = input.authorUserId.trim()
  const mediaId = input.mediaId.trim()
  if (!authorUserId || !mediaId) return { ok: false, reason: 'invalid' }

  const authorBannedAt = await getMemberBannedAt(authorUserId)
  const cache = new Map<string, { mediaId: string; mimeType: string | null } | null>()
  async function resolve(id: string) {
    if (cache.has(id)) return cache.get(id) ?? null
    const resolved = await resolveMediaForAuthor(authorUserId, id)
    cache.set(id, resolved)
    return resolved
  }
  // decideCreateStory is sync — pre-resolve once.
  const media = await resolve(mediaId)
  let lifetimeMs = STORY_TTL_MS
  let storiesEnabled = true
  try {
    const loaded = await loadSocialModuleSettings()
    lifetimeMs = storyLifetimeMs(loaded.settings.storyLifetimeHours)
    storiesEnabled = loaded.settings.allowStories
  } catch {
    lifetimeMs = STORY_TTL_MS
    storiesEnabled = true
  }
  const decision = decideCreateStory(
    { ...input, authorUserId, mediaId, authorBannedAt },
    {
      resolveMedia: () => media,
      lifetimeMs,
      storiesEnabled,
    },
  )
  if (!decision.ok) return decision

  try {
    await db.insert(sfSocialStories).values({
      id: decision.story.id,
      authorUserId: decision.story.authorUserId,
      mediaId: decision.story.mediaId,
      mimeType: decision.story.mimeType,
      expiresAt: decision.story.expiresAt,
      expiredAt: null,
      extensions: decision.story.extensions,
      createdAt: decision.story.createdAt,
      updatedAt: decision.story.updatedAt,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_stories|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'invalid' }
    }
    throw error
  }

  return decision
}

export async function recordStoryView(
  input: Omit<RecordStoryViewInput, 'interact'> & { storyId: string; userId: string },
): Promise<StoryViewMutationResult> {
  const story = await findStory(input.storyId)
  if (!story) return { ok: false, reason: 'not_found' }
  const userId = input.userId.trim()
  if (!userId) return { ok: false, reason: 'invalid' }

  const interact = await interactBetween(userId, story.authorUserId)
  const current = await findStoryView(story.id, userId)
  const decision = decideRecordStoryView(story, current, {
    storyId: story.id,
    userId,
    interact,
  })
  if (!decision.ok) return decision

  try {
    if (decision.write === 'update') {
      await db
        .update(sfSocialStoryViews)
        .set({ updatedAt: decision.view.updatedAt })
        .where(eq(sfSocialStoryViews.id, decision.view.id))
    } else {
      await db
        .insert(sfSocialStoryViews)
        .values({
          id: decision.view.id,
          storyId: decision.view.storyId,
          userId: decision.view.userId,
          createdAt: decision.view.createdAt,
          updatedAt: decision.view.updatedAt,
        })
        .onConflictDoUpdate({
          target: [sfSocialStoryViews.userId, sfSocialStoryViews.storyId],
          set: { updatedAt: decision.view.updatedAt },
        })
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_story_views|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'invalid' }
    }
    throw error
  }

  return decision
}

/** Active stories for the tray / directory (not expired). */
export async function listActiveStories(opts?: {
  authorUserIds?: string[]
  limit?: number
  now?: Date
}): Promise<StoryRecord[]> {
  const now = opts?.now ?? new Date()
  const limit =
    typeof opts?.limit === 'number' && opts.limit > 0
      ? Math.min(Math.floor(opts.limit), 100)
      : 48
  try {
    const conditions = [isNull(sfSocialStories.expiredAt), gt(sfSocialStories.expiresAt, now)]
    if (opts?.authorUserIds && opts.authorUserIds.length > 0) {
      conditions.push(inArray(sfSocialStories.authorUserId, opts.authorUserIds))
    }
    const rows = await db
      .select()
      .from(sfSocialStories)
      .where(and(...conditions))
      .orderBy(desc(sfSocialStories.createdAt))
      .limit(limit)
    return selectActiveStories(rows.map(mapStory), now)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_stories|does not exist|relation/i.test(msg)) return []
    throw error
  }
}

/** Stories by author that are still active (composer / own tray). */
export async function listMyActiveStories(
  authorUserId: string,
  opts?: { limit?: number; now?: Date },
): Promise<StoryRecord[]> {
  const id = authorUserId.trim()
  if (!id) return []
  return listActiveStories({
    authorUserIds: [id],
    limit: opts?.limit,
    now: opts?.now,
  })
}

export type StoryTrayItem = {
  story: StoryRecord
  seen: boolean
}

/** Friends' + own active stories with seen flag for the viewer. */
export async function listStoryTray(
  viewerUserId: string,
  authorUserIds: string[],
  opts?: { limit?: number; now?: Date },
): Promise<StoryTrayItem[]> {
  const viewer = viewerUserId.trim()
  const authors = [...new Set(authorUserIds.map((id) => id.trim()).filter(Boolean))]
  if (viewer && !authors.includes(viewer)) authors.push(viewer)
  if (authors.length === 0) return []

  const stories = await listActiveStories({
    authorUserIds: authors,
    limit: opts?.limit,
    now: opts?.now,
  })
  if (stories.length === 0) return []

  const storyIds = stories.map((row) => row.id)
  let views: StoryViewRecord[] = []
  if (viewer) {
    try {
      const rows = await db
        .select()
        .from(sfSocialStoryViews)
        .where(
          and(
            eq(sfSocialStoryViews.userId, viewer),
            inArray(sfSocialStoryViews.storyId, storyIds),
          ),
        )
      views = rows.map(mapView)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      if (!/sf_social_story_views|does not exist|relation/i.test(msg)) throw error
    }
  }

  const seenIds = new Set(views.map((row) => row.storyId))
  return stories.map((story) => ({
    story,
    seen: seenIds.has(story.id),
  }))
}

/** Author-only viewer list; blocked / hidden / banned viewers omitted. */
export async function listStoryViewersForAuthor(
  storyId: string,
  authorUserId: string,
): Promise<string[]> {
  const story = await findStory(storyId)
  if (!story || story.authorUserId !== authorUserId.trim()) return []
  if (isStoryExpired(story, new Date())) return []

  let views: StoryViewRecord[] = []
  try {
    const rows = await db
      .select()
      .from(sfSocialStoryViews)
      .where(eq(sfSocialStoryViews.storyId, story.id))
    views = rows.map(mapView)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_story_views|does not exist|relation/i.test(msg)) return []
    throw error
  }

  const out: string[] = []
  const seen = new Set<string>()
  for (const view of views) {
    if (view.storyId !== story.id) continue
    const viewer = view.userId.trim()
    if (!viewer || viewer === story.authorUserId) continue
    if (seen.has(viewer)) continue
    const interact = await interactBetween(viewer, story.authorUserId)
    if (listStoryViewerIds(story, [view], () => interact).includes(viewer)) {
      seen.add(viewer)
      out.push(viewer)
    }
  }
  return out
}

/**
 * Apply decideStorySweep against open stories in the DB.
 * Marks expiredAt; does not delete the Media file.
 */
export async function applyStorySweepFromDb(
  now = new Date(),
): Promise<StorySweepDbResult> {
  try {
    const openRows = await db
      .select()
      .from(sfSocialStories)
      .where(and(isNull(sfSocialStories.expiredAt), lte(sfSocialStories.expiresAt, now)))

    const stories = openRows.map(mapStory)
    if (stories.length === 0) return { expired: 0 }

    const decision = decideStorySweep(stories, now)
    if (decision.expireIds.length === 0) return { expired: 0 }

    await db
      .update(sfSocialStories)
      .set({ expiredAt: decision.expiredAt, updatedAt: decision.expiredAt })
      .where(inArray(sfSocialStories.id, decision.expireIds))

    return { expired: decision.expireIds.length }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_stories|does not exist|relation/i.test(msg)) {
      return { expired: 0 }
    }
    throw error
  }
}

export type { StoryRefuseReason }
