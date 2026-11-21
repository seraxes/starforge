/**
 * product:social write gate — canInteract(a, b).
 *
 * Comments, follows, mentions, group invites, story viewers, member albums,
 * shares, likes, posts, and friend requests call this. They do not re-derive
 * the block / hidden / banned rules. Banned comes from Social `bannedAt` on
 * the member row.
 */

export type CanInteractContext = {
  /**
   * True when either person has blocked the other.
   * Callers resolve from the pair query (`blockedBy` / `blockedByOther`).
   */
  isBlocked: boolean
  actorHidden: boolean
  otherHidden: boolean
  /** Social member `bannedAt` for the actor. Null = not banned. */
  actorBannedAt: Date | null
  /** Social member `bannedAt` for the other person. Null = not banned. */
  otherBannedAt: Date | null
}

/** True when a Social `bannedAt` timestamp is set. */
export function isSocialBanned(bannedAt: Date | null | undefined): boolean {
  return bannedAt != null
}

/**
 * Write check between two members.
 * False when either side blocked the other (either blocker column), either
 * account is hidden, or either has a Social `bannedAt`. Empty ids are refused.
 */
export function canInteract(
  actorUserId: string,
  otherUserId: string,
  ctx: CanInteractContext,
): boolean {
  const actor = actorUserId.trim()
  const other = otherUserId.trim()
  if (!actor || !other) return false
  if (ctx.isBlocked) return false
  if (ctx.actorHidden || ctx.otherHidden) return false
  if (isSocialBanned(ctx.actorBannedAt) || isSocialBanned(ctx.otherBannedAt)) return false
  return true
}
