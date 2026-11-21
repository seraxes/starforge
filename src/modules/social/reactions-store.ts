/**
 * product:social reaction persistence (sf_social_reactions).
 * Unique on (actorUserId, targetType, targetId). Enabled kinds from the
 * reaction catalog (pack settings; default `like` only).
 */

import 'server-only'

import { and, eq } from 'drizzle-orm'

import { db } from '@/core/db'

import { canInteract, type CanInteractContext } from './interact'
import { areBlocked } from './friends-store'
import { getMemberBannedAt, isMemberAccountHidden } from './members-store'
import { canViewerSeePost, findPost } from './posts-store'
import { DEFAULT_ENABLED_REACTION_KINDS, decidePostLike, isReactionKind, isReactionTargetType, type ReactionMutationResult, type ReactionRecord, type SetPostLikeInput } from './reactions'
import { loadSocialModuleSettings } from './settings'
import { sfSocialReactions } from './schema'

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
