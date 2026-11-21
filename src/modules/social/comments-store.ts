/**
 * product:social comment persistence (sf_social_comments).
 * One reply deep. Create calls canViewPost + canInteract.
 */

import 'server-only'

import { asc, eq, inArray } from 'drizzle-orm'

import { db } from '@/core/db'

import { type CanInteractContext } from './interact'
import { canActorInteractWith } from './reactions-store'
import { canViewerSeePost, findPost } from './posts-store'
import {
  decideCreateComment,
  decideDeleteComment,
  decideEditComment,
  decideStaffHideComment,
  type CommentDeleteResult,
  type CommentMutationResult,
  type CommentRecord,
  type CreateCommentInput,
  type DeleteCommentInput,
  type EditCommentInput,
  type StaffHideCommentInput,
} from './comments'
import { sfSocialComments } from './schema'

function mapRow(row: typeof sfSocialComments.$inferSelect): CommentRecord {
  return {
    id: row.id,
    postId: row.postId,
    authorUserId: row.authorUserId,
    body: row.body,
    parentCommentId: row.parentCommentId,
    staffHidden: row.staffHidden,
    editedAt: row.editedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function findComment(commentId: string): Promise<CommentRecord | null> {
  const id = commentId.trim()
  if (!id) return null
  try {
    const rows = await db
      .select()
      .from(sfSocialComments)
      .where(eq(sfSocialComments.id, id))
      .limit(1)
    return rows[0] ? mapRow(rows[0]) : null
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_comments|does not exist|relation/i.test(msg)) return null
    throw error
  }
}

export async function listCommentsForPost(postId: string): Promise<CommentRecord[]> {
  const id = postId.trim()
  if (!id) return []
  try {
    const rows = await db
      .select()
      .from(sfSocialComments)
      .where(eq(sfSocialComments.postId, id))
      .orderBy(asc(sfSocialComments.createdAt))
    return rows.map(mapRow)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_comments|does not exist|relation/i.test(msg)) return []
    throw error
  }
}

async function listReplyIds(parentCommentId: string): Promise<string[]> {
  const id = parentCommentId.trim()
  if (!id) return []
  try {
    const rows = await db
      .select({ id: sfSocialComments.id })
      .from(sfSocialComments)
      .where(eq(sfSocialComments.parentCommentId, id))
    return rows.map((row) => row.id)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_comments|does not exist|relation/i.test(msg)) return []
    throw error
  }
}

/**
 * Create a comment or one-level reply.
 * Refuses when canViewPost denies, canInteract denies, or parent is already a reply.
 */
export async function createComment(
  input: CreateCommentInput,
  extras?: {
    view?: Parameters<typeof canViewerSeePost>[2]
    interact?: Partial<CanInteractContext>
  },
): Promise<CommentMutationResult> {
  const author = input.authorUserId.trim()
  const postId = input.postId.trim()
  if (!author || !postId) return { ok: false, reason: 'invalid' }

  const post = await findPost(postId)
  if (!post) return { ok: false, reason: 'cannot_view' }

  const parentId = input.parentCommentId?.trim() || null
  const parent = parentId ? await findComment(parentId) : null

  const [canView, interactOk] = await Promise.all([
    canViewerSeePost(author, post, extras?.view),
    canActorInteractWith(author, post.authorUserId, extras?.interact),
  ])

  const { loadSocialModuleSettings } = await import('./settings')
  const pack = await loadSocialModuleSettings()
  const decision = decideCreateComment(
    input,
    {
      canView,
      canInteract: interactOk,
      parent,
    },
    {
      commentsEnabled: pack.settings.allowComments,
      commentLengthLimit: pack.settings.commentLengthLimit,
      blockedWords: pack.settings.blockedWords,
    },
  )
  if (!decision.ok) return { ok: false, reason: decision.reason }

  const next = decision.comment
  try {
    await db.insert(sfSocialComments).values({
      id: next.id,
      postId: next.postId,
      authorUserId: next.authorUserId,
      body: next.body,
      parentCommentId: next.parentCommentId,
      staffHidden: next.staffHidden,
      editedAt: next.editedAt,
      createdAt: next.createdAt,
      updatedAt: next.updatedAt,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_comments|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'invalid' }
    }
    throw error
  }

  const stored = await findComment(next.id)
  return stored
    ? { ok: true, comment: stored }
    : { ok: true, comment: next }
}

export async function editComment(
  input: EditCommentInput,
): Promise<CommentMutationResult> {
  const current = await findComment(input.commentId)
  const result = decideEditComment(current, input)
  if (!result.ok) return result

  const next = result.comment
  try {
    await db
      .update(sfSocialComments)
      .set({
        body: next.body,
        editedAt: next.editedAt,
        updatedAt: next.updatedAt,
      })
      .where(eq(sfSocialComments.id, next.id))
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_comments|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'invalid' }
    }
    throw error
  }

  const stored = await findComment(next.id)
  return stored
    ? { ok: true, comment: stored }
    : { ok: true, comment: next }
}

/**
 * Staff hide / restore a comment. Requires social.posts manage.
 */
export async function setCommentStaffHidden(
  input: StaffHideCommentInput,
  gates: { canManagePosts: boolean },
): Promise<CommentMutationResult> {
  const current = await findComment(input.commentId)
  const result = decideStaffHideComment(current, input, gates)
  if (!result.ok) return result

  const next = result.comment
  try {
    await db
      .update(sfSocialComments)
      .set({
        staffHidden: next.staffHidden,
        updatedAt: next.updatedAt,
      })
      .where(eq(sfSocialComments.id, next.id))
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_comments|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'invalid' }
    }
    throw error
  }

  const stored = await findComment(next.id)
  return stored ? { ok: true, comment: stored } : { ok: true, comment: next }
}

/**
 * Author delete. Parent delete also removes its one reply in the same transaction.
 */
export async function deleteComment(
  input: DeleteCommentInput,
): Promise<CommentDeleteResult> {
  const current = await findComment(input.commentId)
  const replyIds = current ? await listReplyIds(current.id) : []
  const result = decideDeleteComment(current, input, replyIds)
  if (!result.ok) return result

  try {
    await db.transaction(async (tx) => {
      if (result.deletedIds.length === 1) {
        await tx
          .delete(sfSocialComments)
          .where(eq(sfSocialComments.id, result.deletedIds[0]!))
      } else {
        await tx
          .delete(sfSocialComments)
          .where(inArray(sfSocialComments.id, result.deletedIds))
      }
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_comments|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'invalid' }
    }
    throw error
  }

  return result
}
