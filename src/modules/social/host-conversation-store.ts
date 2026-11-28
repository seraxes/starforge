/**
 * product:social host conversation persistence
 * (sf_social_conversations + linked kind=conversation post).
 */

import 'server-only'

import { and, eq } from 'drizzle-orm'

import { db } from '@/core/db'

import {
  decideEnsureHostConversation,
  type EnsureHostConversationInput,
  type EnsureHostConversationResult,
  type HostConversationRecord,
} from './host-conversation'
import { toPostRecord, type PostRecord } from './posts'
import { sfSocialConversations, sfSocialPosts } from './schema'

function mapConversationRow(
  row: typeof sfSocialConversations.$inferSelect,
): HostConversationRecord {
  return {
    id: row.id,
    hostModule: row.hostModule,
    hostId: row.hostId,
    postId: row.postId,
    hostPath: row.hostPath ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapPostRow(row: typeof sfSocialPosts.$inferSelect): PostRecord | null {
  return toPostRecord(row)
}

export async function findConversationByHost(
  hostModule: string,
  hostId: string,
): Promise<HostConversationRecord | null> {
  const sm = hostModule.trim()
  const sid = hostId.trim()
  if (!sm || !sid) return null
  try {
    const rows = await db
      .select()
      .from(sfSocialConversations)
      .where(
        and(
          eq(sfSocialConversations.hostModule, sm),
          eq(sfSocialConversations.hostId, sid),
        ),
      )
      .limit(1)
    return rows[0] ? mapConversationRow(rows[0]) : null
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_conversations|does not exist|relation/i.test(msg)) return null
    throw error
  }
}

export async function findConversationByPostId(
  postId: string,
): Promise<HostConversationRecord | null> {
  const id = postId.trim()
  if (!id) return null
  try {
    const rows = await db
      .select()
      .from(sfSocialConversations)
      .where(eq(sfSocialConversations.postId, id))
      .limit(1)
    return rows[0] ? mapConversationRow(rows[0]) : null
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_conversations|does not exist|relation/i.test(msg)) return null
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
 * Insert or update the host conversation + linked kind=conversation post.
 * Soft-fails missing tables as `failed`.
 */
export async function ensureHostConversationInDb(
  input: EnsureHostConversationInput,
): Promise<EnsureHostConversationResult> {
  const current = await findConversationByHost(input.hostModule, input.hostId)
  const currentPost = current ? await findLinkedPost(current.postId) : null
  const decision = decideEnsureHostConversation(current, currentPost, input)
  if (!decision.ok) return decision
  if (decision.write === 'noop') {
    return { ok: true, conversation: decision.conversation, post: decision.post }
  }

  const { conversation, post } = decision
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
          pendingReview: post.pendingReview,
          isAnnouncement: post.isAnnouncement,
          editedAt: post.editedAt,
          extensions: post.extensions,
          createdAt: post.createdAt,
          updatedAt: post.updatedAt,
        })
        await tx.insert(sfSocialConversations).values({
          id: conversation.id,
          hostModule: conversation.hostModule,
          hostId: conversation.hostId,
          postId: conversation.postId,
          hostPath: conversation.hostPath,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
        })
        return
      }

      await tx
        .update(sfSocialConversations)
        .set({
          hostPath: conversation.hostPath,
          updatedAt: conversation.updatedAt,
        })
        .where(eq(sfSocialConversations.id, conversation.id))
      await tx
        .update(sfSocialPosts)
        .set({
          authorUserId: post.authorUserId,
          kind: post.kind,
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

  return { ok: true, conversation, post }
}
