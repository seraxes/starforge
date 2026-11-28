/**
 * product:social quiet persistence — post hides + person mutes.
 *
 * Hide requires canViewPost. Mute leaves friendship / follow / block alone.
 * Feed SQL lists call listHiddenPostIdsForViewer / listMutedAuthorIdsForViewer
 * and exclude before LIMIT.
 */

import 'server-only'

import { and, eq } from 'drizzle-orm'

import { db } from '@/core/db'

import { getMemberBannedAt } from './members-store'
import { canViewerSeePost, findPost } from './posts-store'
import {
  decideHidePost,
  decideMute,
  decideUnhidePost,
  decideUnmute,
  type HidePostMutationResult,
  type MuteMutationResult,
  type MuteRecord,
  type PostHideRecord,
  type UnhidePostMutationResult,
  type UnmuteMutationResult,
} from './quiet'
import { sfSocialMutes, sfSocialPostHides } from './schema'

function mapHide(row: typeof sfSocialPostHides.$inferSelect): PostHideRecord {
  return {
    id: row.id,
    userId: row.userId,
    postId: row.postId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapMute(row: typeof sfSocialMutes.$inferSelect): MuteRecord {
  return {
    id: row.id,
    muterUserId: row.muterUserId,
    mutedUserId: row.mutedUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function findPostHide(
  userId: string,
  postId: string,
): Promise<PostHideRecord | null> {
  const uid = userId.trim()
  const pid = postId.trim()
  if (!uid || !pid) return null
  try {
    const [row] = await db
      .select()
      .from(sfSocialPostHides)
      .where(and(eq(sfSocialPostHides.userId, uid), eq(sfSocialPostHides.postId, pid)))
      .limit(1)
    return row ? mapHide(row) : null
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_post_hides|does not exist|relation/i.test(msg)) return null
    throw error
  }
}

export async function findMute(
  muterUserId: string,
  mutedUserId: string,
): Promise<MuteRecord | null> {
  const muter = muterUserId.trim()
  const muted = mutedUserId.trim()
  if (!muter || !muted) return null
  try {
    const [row] = await db
      .select()
      .from(sfSocialMutes)
      .where(
        and(
          eq(sfSocialMutes.muterUserId, muter),
          eq(sfSocialMutes.mutedUserId, muted),
        ),
      )
      .limit(1)
    return row ? mapMute(row) : null
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_mutes|does not exist|relation/i.test(msg)) return null
    throw error
  }
}

/** Post ids this viewer has hidden (home / following / discover SQL). */
export async function listHiddenPostIdsForViewer(
  userId: string,
): Promise<Set<string>> {
  const uid = userId.trim()
  if (!uid) return new Set()
  try {
    const rows = await db
      .select({ postId: sfSocialPostHides.postId })
      .from(sfSocialPostHides)
      .where(eq(sfSocialPostHides.userId, uid))
    return new Set(rows.map((row) => row.postId).filter(Boolean))
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_post_hides|does not exist|relation/i.test(msg)) return new Set()
    throw error
  }
}

/** Authors this viewer has muted (home / following / discover SQL). */
export async function listMutedAuthorIdsForViewer(
  userId: string,
): Promise<Set<string>> {
  const uid = userId.trim()
  if (!uid) return new Set()
  try {
    const rows = await db
      .select({ mutedUserId: sfSocialMutes.mutedUserId })
      .from(sfSocialMutes)
      .where(eq(sfSocialMutes.muterUserId, uid))
    return new Set(rows.map((row) => row.mutedUserId).filter(Boolean))
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_mutes|does not exist|relation/i.test(msg)) return new Set()
    throw error
  }
}

/** Hide a post. Refused when canViewPost denies. Idempotent unique pair. */
export async function hidePost(input: {
  userId: string
  postId: string
}): Promise<HidePostMutationResult> {
  const userId = input.userId.trim()
  const postId = input.postId.trim()
  const post = await findPost(postId)
  const canView = post ? await canViewerSeePost(userId, post) : false
  const actorBannedAt = userId ? await getMemberBannedAt(userId) : null
  const current = await findPostHide(userId, postId)
  const decision = decideHidePost(
    current,
    { userId, postId, actorBannedAt },
    { canView },
  )
  if (!decision.ok) return decision

  try {
    if (decision.write === 'update' && current) {
      await db
        .update(sfSocialPostHides)
        .set({ updatedAt: decision.hide.updatedAt })
        .where(eq(sfSocialPostHides.id, current.id))
    } else {
      try {
        await db.insert(sfSocialPostHides).values({
          id: decision.hide.id,
          userId: decision.hide.userId,
          postId: decision.hide.postId,
          createdAt: decision.hide.createdAt,
          updatedAt: decision.hide.updatedAt,
        })
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        if (!/unique|duplicate/i.test(msg)) throw error
        const existing = await findPostHide(userId, postId)
        if (!existing) throw error
        await db
          .update(sfSocialPostHides)
          .set({ updatedAt: decision.hide.updatedAt })
          .where(eq(sfSocialPostHides.id, existing.id))
        return {
          ok: true,
          write: 'update',
          hide: { ...existing, updatedAt: decision.hide.updatedAt },
        }
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_post_hides|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'invalid' }
    }
    throw error
  }

  return decision
}

export async function unhidePost(
  userId: string,
  postId: string,
): Promise<UnhidePostMutationResult> {
  const current = await findPostHide(userId, postId)
  const decision = decideUnhidePost(current, userId, postId)
  if (!decision.ok) return decision
  try {
    await db
      .delete(sfSocialPostHides)
      .where(eq(sfSocialPostHides.id, decision.removed.id))
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_post_hides|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'invalid' }
    }
    throw error
  }
  return decision
}

/** Mute a person. Does not notify; friendship / follow / block unchanged. */
export async function muteUser(input: {
  muterUserId: string
  mutedUserId: string
}): Promise<MuteMutationResult> {
  const muterUserId = input.muterUserId.trim()
  const mutedUserId = input.mutedUserId.trim()
  const actorBannedAt = muterUserId ? await getMemberBannedAt(muterUserId) : null
  const current = await findMute(muterUserId, mutedUserId)
  const decision = decideMute(current, {
    muterUserId,
    mutedUserId,
    actorBannedAt,
  })
  if (!decision.ok) return decision

  try {
    if (decision.write === 'update' && current) {
      await db
        .update(sfSocialMutes)
        .set({ updatedAt: decision.mute.updatedAt })
        .where(eq(sfSocialMutes.id, current.id))
    } else {
      try {
        await db.insert(sfSocialMutes).values({
          id: decision.mute.id,
          muterUserId: decision.mute.muterUserId,
          mutedUserId: decision.mute.mutedUserId,
          createdAt: decision.mute.createdAt,
          updatedAt: decision.mute.updatedAt,
        })
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        if (!/unique|duplicate/i.test(msg)) throw error
        const existing = await findMute(muterUserId, mutedUserId)
        if (!existing) throw error
        await db
          .update(sfSocialMutes)
          .set({ updatedAt: decision.mute.updatedAt })
          .where(eq(sfSocialMutes.id, existing.id))
        return {
          ok: true,
          write: 'update',
          mute: { ...existing, updatedAt: decision.mute.updatedAt },
        }
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_mutes|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'invalid' }
    }
    throw error
  }

  return decision
}

export async function unmuteUser(
  muterUserId: string,
  mutedUserId: string,
): Promise<UnmuteMutationResult> {
  const current = await findMute(muterUserId, mutedUserId)
  const decision = decideUnmute(current, muterUserId, mutedUserId)
  if (!decision.ok) return decision
  try {
    await db.delete(sfSocialMutes).where(eq(sfSocialMutes.id, decision.removed.id))
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_mutes|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'invalid' }
    }
    throw error
  }
  return decision
}
