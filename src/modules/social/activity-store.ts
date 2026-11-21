/**
 * product:social activity persistence (sf_social_activities + linked post).
 *
 * Unique (sourceModule, sourceId, activityKind). Never throws to the caller —
 * publishActivity on the door catches and returns failed so Events / Pages
 * publish is not taken down by a Social error.
 */

import 'server-only'

import { and, eq } from 'drizzle-orm'

import { db } from '@/core/db'

import {
  decidePublishActivity,
  type ActivityRecord,
  type ActivitySnapshot,
  type PublishActivityInput,
  type PublishActivityResult,
} from './activity'
import { isActivityCardEnabled } from './pack-settings'
import { toPostRecord, type PostRecord } from './posts'
import { loadSocialModuleSettings } from './settings'
import { sfSocialActivities, sfSocialPosts } from './schema'

function mapActivityRow(
  row: typeof sfSocialActivities.$inferSelect,
): ActivityRecord | null {
  const snapshot =
    row.snapshot && typeof row.snapshot === 'object' && !Array.isArray(row.snapshot)
      ? (row.snapshot as ActivitySnapshot)
      : {}
  return {
    id: row.id,
    sourceModule: row.sourceModule,
    sourceId: row.sourceId,
    activityKind: row.activityKind,
    actorUserId: row.actorUserId,
    postId: row.postId,
    snapshot,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapPostRow(row: typeof sfSocialPosts.$inferSelect): PostRecord | null {
  return toPostRecord(row)
}

export async function findActivityByKey(
  sourceModule: string,
  sourceId: string,
  activityKind: string,
): Promise<ActivityRecord | null> {
  const sm = sourceModule.trim()
  const sid = sourceId.trim()
  const kind = activityKind.trim()
  if (!sm || !sid || !kind) return null
  try {
    const rows = await db
      .select()
      .from(sfSocialActivities)
      .where(
        and(
          eq(sfSocialActivities.sourceModule, sm),
          eq(sfSocialActivities.sourceId, sid),
          eq(sfSocialActivities.activityKind, kind),
        ),
      )
      .limit(1)
    return rows[0] ? mapActivityRow(rows[0]) : null
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_activities|does not exist|relation/i.test(msg)) return null
    throw error
  }
}

async function findLinkedPost(postId: string): Promise<PostRecord | null> {
  const id = postId.trim()
  if (!id) return null
  try {
    const rows = await db
      .select()
      .from(sfSocialPosts)
      .where(eq(sfSocialPosts.id, id))
      .limit(1)
    return rows[0] ? mapPostRow(rows[0]) : null
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_posts|does not exist|relation/i.test(msg)) return null
    throw error
  }
}

/**
 * Insert or update the activity card + linked kind=activity post.
 * Soft-fails missing tables as `failed` (callers must not abort their publish).
 */
export async function publishActivityInDb(
  input: PublishActivityInput,
): Promise<PublishActivityResult> {
  try {
    const loaded = await loadSocialModuleSettings()
    if (!isActivityCardEnabled(input.activityKind, loaded.settings)) {
      return { ok: false, reason: 'disabled' }
    }
  } catch {
    // Settings unreadable — switches default on, so publish continues.
  }

  const current = await findActivityByKey(
    input.sourceModule,
    input.sourceId,
    input.activityKind,
  )
  const currentPost = current ? await findLinkedPost(current.postId) : null
  const decision = decidePublishActivity(current, currentPost, input)
  if (!decision.ok) return decision
  if (decision.write === 'noop') {
    return { ok: true, activity: decision.activity, post: decision.post }
  }

  const { activity, post } = decision
  try {
    await db.transaction(async (tx) => {
      if (decision.write === 'insert') {
        await tx.insert(sfSocialPosts).values({
          id: post.id,
          authorUserId: post.authorUserId,
          body: post.body,
          kind: post.kind,
          audience: post.audience,
          groupId: post.groupId,
          pageId: post.pageId,
          staffHidden: post.staffHidden,
          isAnnouncement: post.isAnnouncement,
          editedAt: post.editedAt,
          extensions: post.extensions,
          createdAt: post.createdAt,
          updatedAt: post.updatedAt,
        })
        await tx.insert(sfSocialActivities).values({
          id: activity.id,
          sourceModule: activity.sourceModule,
          sourceId: activity.sourceId,
          activityKind: activity.activityKind,
          actorUserId: activity.actorUserId,
          postId: activity.postId,
          snapshot: activity.snapshot,
          createdAt: activity.createdAt,
          updatedAt: activity.updatedAt,
        })
        return
      }

      await tx
        .update(sfSocialActivities)
        .set({
          actorUserId: activity.actorUserId,
          snapshot: activity.snapshot,
          updatedAt: activity.updatedAt,
        })
        .where(eq(sfSocialActivities.id, activity.id))
      await tx
        .update(sfSocialPosts)
        .set({
          authorUserId: post.authorUserId,
          body: post.body,
          kind: post.kind,
          audience: post.audience,
          updatedAt: post.updatedAt,
        })
        .where(eq(sfSocialPosts.id, post.id))
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'failed' }
    }
    throw error
  }

  return { ok: true, activity, post }
}
