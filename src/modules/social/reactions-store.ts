/**
 * product:social reaction persistence (sf_social_reactions).
 * Unique on (actorUserId, targetType, targetId). Enabled kinds from the
 * reaction catalog (pack settings; default `like` only).
 */

import 'server-only'

import { and, eq, inArray, or } from 'drizzle-orm'

import { db } from '@/core/db'

import { canInteract, type CanInteractContext } from './interact'
import { areBlocked } from './friends-store'
import { getMemberBannedAt, isMemberAccountHidden } from './members-store'
import { canViewerSeePost, findPost } from './posts-store'
import { DEFAULT_ENABLED_REACTION_KINDS, decideClearReaction, decideCommentLike, decidePostLike, isReactionKind, isReactionTargetType, type ReactionMutationResult, type ReactionRecord, type ReactionRefuseReason, type ReactionTargetType, type SetCommentLikeInput, type SetPostLikeInput } from './reactions'
import { loadSocialModuleSettings } from './settings'
import { sfSocialComments, sfSocialReactions } from './schema'

function mapRow(row: typeof sfSocialReactions.$inferSelect): ReactionRecord | null {
  if (!isReactionKind(row.kind) || !isReactionTargetType(row.targetType)) return null
  return {
    id: row.id,
    actorUserId: row.actorUserId,
    targetType: row.targetType,
    targetId: row.targetId,
    kind: row.kind,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function findReaction(
  actorUserId: string,
  targetType: string,
  targetId: string,
): Promise<ReactionRecord | null> {
  const actor = actorUserId.trim()
  const type = targetType.trim()
  const id = targetId.trim()
  if (!actor || !type || !id || !isReactionTargetType(type)) return null
  try {
    const rows = await db
      .select()
      .from(sfSocialReactions)
      .where(
        and(
          eq(sfSocialReactions.actorUserId, actor),
          eq(sfSocialReactions.targetType, type),
          eq(sfSocialReactions.targetId, id),
        ),
      )
      .limit(1)
    return rows[0] ? mapRow(rows[0]) : null
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_reactions|does not exist|relation/i.test(msg)) return null
    throw error
  }
}

/**
 * Resolve canInteract for a pair.
 * Block from the friendship row; bannedAt / hiddenAt from sf_social_members.
 */
export async function canActorInteractWith(
  actorUserId: string,
  otherUserId: string,
  extras?: Partial<CanInteractContext>,
): Promise<boolean> {
  const actor = actorUserId.trim()
  const other = otherUserId.trim()
  if (!actor || !other) return false

  const loadBanned = async (
    userId: string,
    override: Date | null | undefined,
  ): Promise<Date | null> =>
    override !== undefined ? override : getMemberBannedAt(userId)

  const loadHidden = async (
    userId: string,
    override: boolean | undefined,
  ): Promise<boolean> =>
    override !== undefined ? override : isMemberAccountHidden(userId)

  const [isBlocked, actorBannedAt, otherBannedAt, actorHidden, otherHidden] =
    await Promise.all([
      actor === other ? false : areBlocked(actor, other),
      loadBanned(actor, extras?.actorBannedAt),
      loadBanned(other, extras?.otherBannedAt),
      loadHidden(actor, extras?.actorHidden),
      loadHidden(other, extras?.otherHidden),
    ])

  return canInteract(actor, other, {
    isBlocked,
    actorHidden,
    otherHidden,
    actorBannedAt,
    otherBannedAt,
  })
}

/**
 * React to a post. Refuses when canViewPost denies, canInteract denies,
 * kind is unknown, or kind is disabled in the catalog (default: only `like`).
 * Second reaction on the same post upserts / noops the one unique row.
 */
export async function likePost(
  input: SetPostLikeInput,
  extras?: {
    view?: Parameters<typeof canViewerSeePost>[2]
    interact?: Partial<CanInteractContext>
  },
): Promise<ReactionMutationResult> {
  const actor = input.actorUserId.trim()
  const postId = input.postId.trim()
  if (!actor || !postId) return { ok: false, reason: 'invalid' }

  const post = await findPost(postId)
  if (!post) return { ok: false, reason: 'cannot_view' }

  const [canView, interactOk] = await Promise.all([
    canViewerSeePost(actor, post, extras?.view),
    canActorInteractWith(actor, post.authorUserId, extras?.interact),
  ])

  const current = await findReaction(actor, 'post', postId)
  let enabledKinds: readonly string[] = DEFAULT_ENABLED_REACTION_KINDS
  try {
    const loaded = await loadSocialModuleSettings()
    enabledKinds = loaded.settings.enabledReactionKinds
  } catch {
    enabledKinds = DEFAULT_ENABLED_REACTION_KINDS
  }
  const decision = decidePostLike(current, input, { canView, canInteract: interactOk }, {
    enabledKinds,
  })
  if (!decision.ok) return { ok: false, reason: decision.reason }

  if (decision.write === 'noop') {
    return { ok: true, reaction: decision.reaction }
  }

  const next = decision.reaction
  try {
    await db
      .insert(sfSocialReactions)
      .values({
        id: next.id,
        actorUserId: next.actorUserId,
        targetType: next.targetType,
        targetId: next.targetId,
        kind: next.kind,
        createdAt: next.createdAt,
        updatedAt: next.updatedAt,
      })
      .onConflictDoUpdate({
        target: [
          sfSocialReactions.actorUserId,
          sfSocialReactions.targetType,
          sfSocialReactions.targetId,
        ],
        set: {
          kind: next.kind,
          updatedAt: next.updatedAt,
        },
      })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_reactions|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'invalid' }
    }
    throw error
  }

  const stored = await findReaction(actor, 'post', postId)
  return stored
    ? { ok: true, reaction: stored }
    : { ok: true, reaction: next }
}

/**
 * React to a comment. Refuses when the post is hidden, the pair cannot
 * interact, the kind is disabled, or reactions on comments are off.
 */
export async function likeComment(
  input: SetCommentLikeInput,
): Promise<ReactionMutationResult> {
  const actor = input.actorUserId.trim()
  const commentId = input.commentId.trim()
  if (!actor || !commentId) return { ok: false, reason: 'invalid' }

  let commentAuthor = ''
  let postId = ''
  let staffHidden = false
  try {
    const rows = await db
      .select({
        authorUserId: sfSocialComments.authorUserId,
        postId: sfSocialComments.postId,
        staffHidden: sfSocialComments.staffHidden,
      })
      .from(sfSocialComments)
      .where(eq(sfSocialComments.id, commentId))
      .limit(1)
    const row = rows[0]
    if (!row) return { ok: false, reason: 'cannot_view' }
    commentAuthor = row.authorUserId
    postId = row.postId
    staffHidden = row.staffHidden
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_comments|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'invalid' }
    }
    throw error
  }

  if (staffHidden && commentAuthor !== actor) {
    return { ok: false, reason: 'cannot_view' }
  }

  const post = await findPost(postId)
  if (!post) return { ok: false, reason: 'cannot_view' }

  const [canView, interactOk, pack] = await Promise.all([
    canViewerSeePost(actor, post),
    canActorInteractWith(actor, commentAuthor),
    loadSocialModuleSettings().catch(() => null),
  ])

  const current = await findReaction(actor, 'comment', commentId)
  const decision = decideCommentLike(
    current,
    input,
    {
      canView,
      canInteract: interactOk,
      reactionsOnComments: pack?.settings.allowReactionsOnComments === true,
    },
    { enabledKinds: pack?.settings.enabledReactionKinds ?? DEFAULT_ENABLED_REACTION_KINDS },
  )
  if (!decision.ok) return { ok: false, reason: decision.reason }
  if (decision.write === 'noop') return { ok: true, reaction: decision.reaction }

  const next = decision.reaction
  try {
    await db
      .insert(sfSocialReactions)
      .values({
        id: next.id,
        actorUserId: next.actorUserId,
        targetType: next.targetType,
        targetId: next.targetId,
        kind: next.kind,
        createdAt: next.createdAt,
        updatedAt: next.updatedAt,
      })
      .onConflictDoUpdate({
        target: [
          sfSocialReactions.actorUserId,
          sfSocialReactions.targetType,
          sfSocialReactions.targetId,
        ],
        set: { kind: next.kind, updatedAt: next.updatedAt },
      })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_reactions|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'invalid' }
    }
    throw error
  }

  const stored = await findReaction(actor, 'comment', commentId)
  return stored ? { ok: true, reaction: stored } : { ok: true, reaction: next }
}

export type ClearReactionResult =
  | { ok: true; cleared: boolean }
  | { ok: false; reason: ReactionRefuseReason }

/**
 * Take the viewer's reaction off a post or comment.
 * Clicking the active Like control sends this. Setting the same kind still noops.
 */
export async function clearReaction(input: {
  actorUserId: string
  targetType: ReactionTargetType
  targetId: string
}): Promise<ClearReactionResult> {
  const actor = input.actorUserId.trim()
  const targetType = input.targetType
  const targetId = input.targetId.trim()
  if (!actor || !targetId || !isReactionTargetType(targetType)) {
    return { ok: false, reason: 'invalid' }
  }

  let canView = false
  let interactOk = false

  if (targetType === 'post') {
    const post = await findPost(targetId)
    if (!post) return { ok: false, reason: 'cannot_view' }
    ;[canView, interactOk] = await Promise.all([
      canViewerSeePost(actor, post),
      canActorInteractWith(actor, post.authorUserId),
    ])
  } else {
    let commentAuthor = ''
    let postId = ''
    let staffHidden = false
    try {
      const rows = await db
        .select({
          authorUserId: sfSocialComments.authorUserId,
          postId: sfSocialComments.postId,
          staffHidden: sfSocialComments.staffHidden,
        })
        .from(sfSocialComments)
        .where(eq(sfSocialComments.id, targetId))
        .limit(1)
      const row = rows[0]
      if (!row) return { ok: false, reason: 'cannot_view' }
      commentAuthor = row.authorUserId
      postId = row.postId
      staffHidden = row.staffHidden
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      if (/sf_social_comments|does not exist|relation/i.test(msg)) {
        return { ok: false, reason: 'invalid' }
      }
      throw error
    }
    if (staffHidden && commentAuthor !== actor) {
      return { ok: false, reason: 'cannot_view' }
    }
    const post = await findPost(postId)
    if (!post) return { ok: false, reason: 'cannot_view' }
    ;[canView, interactOk] = await Promise.all([
      canViewerSeePost(actor, post),
      canActorInteractWith(actor, commentAuthor),
    ])
  }

  const current = await findReaction(actor, targetType, targetId)
  const decision = decideClearReaction(
    current,
    { actorUserId: actor, targetType, targetId },
    { canView, canInteract: interactOk },
  )
  if (!decision.ok) return { ok: false, reason: decision.reason }
  if (decision.write === 'noop') return { ok: true, cleared: false }

  try {
    await db.delete(sfSocialReactions).where(eq(sfSocialReactions.id, decision.reaction.id))
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_reactions|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'invalid' }
    }
    throw error
  }
  return { ok: true, cleared: true }
}

/** Reactions on the posts and comments currently on a feed page. */
export async function listFeedReactions(
  postIds: string[],
  commentIds: string[],
): Promise<ReactionRecord[]> {
  const posts = [...new Set(postIds.map((id) => id.trim()).filter(Boolean))]
  const comments = [...new Set(commentIds.map((id) => id.trim()).filter(Boolean))]
  const clauses = []
  if (posts.length > 0) {
    clauses.push(
      and(eq(sfSocialReactions.targetType, 'post'), inArray(sfSocialReactions.targetId, posts)),
    )
  }
  if (comments.length > 0) {
    clauses.push(
      and(
        eq(sfSocialReactions.targetType, 'comment'),
        inArray(sfSocialReactions.targetId, comments),
      ),
    )
  }
  if (clauses.length === 0) return []
  const where = clauses.length === 1 ? clauses[0] : or(...clauses)
  if (!where) return []

  try {
    const rows = await db.select().from(sfSocialReactions).where(where)
    return rows.flatMap((row) => {
      const mapped = mapRow(row)
      return mapped ? [mapped] : []
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_reactions|does not exist|relation/i.test(msg)) return []
    throw error
  }
}
