/**
 * product:social reactions — Facebook-style catalog (not challenge votes).
 *
 * Unique on (actorUserId, targetType, targetId). Choosing another enabled
 * kind updates that one row. Sending the same kind again is a noop.
 * Removing the active reaction is a separate clear (the Like control toggles).
 * Challenge likes use a different table.
 *
 * Catalog kinds: like, love, haha, wow, sad, angry. Pack settings choose which
 * kinds are on. `like` cannot be turned off. A disabled kind is refused.
 */

import { canInteract, type CanInteractContext } from './interact'
import { canViewPost, type CanViewPostContext, type PostRecord } from './posts'

export const REACTION_KINDS = [
  'like',
  'love',
  'haha',
  'wow',
  'sad',
  'angry',
] as const
export type ReactionKind = (typeof REACTION_KINDS)[number]

/** Default enabled set. Pack settings can add kinds; `like` stays on. */
export const DEFAULT_ENABLED_REACTION_KINDS: readonly ReactionKind[] = ['like']

/**
 * Default Font Awesome 6 solid classes per kind.
 * Admin may override via pack settings `reactionIcons`.
 */
export const DEFAULT_REACTION_ICONS: Readonly<Record<ReactionKind, string>> = {
  like: 'fa-solid fa-thumbs-up',
  love: 'fa-solid fa-heart',
  haha: 'fa-solid fa-face-laugh',
  wow: 'fa-solid fa-face-surprise',
  sad: 'fa-solid fa-face-sad-tear',
  angry: 'fa-solid fa-face-angry',
}

/** Default FA tint per kind (ignored when a media image is set). */
export const DEFAULT_REACTION_ICON_COLORS: Readonly<Record<ReactionKind, string>> = {
  like: '#0866ff',
  love: '#f33e58',
  haha: '#f7b125',
  wow: '#f7b125',
  sad: '#f7b125',
  angry: '#e9710f',
}

export type ReactionIcons = Record<ReactionKind, string>
export type ReactionIconColors = Record<ReactionKind, string>
/** Empty string = no image; use FA class + color. */
export type ReactionIconMediaIds = Record<ReactionKind, string>
/** Resolved public URLs for kinds that use a Media image. */
export type ReactionIconImageUrls = Partial<Record<ReactionKind, string>>

export const REACTION_TARGET_TYPES = ['post', 'comment'] as const
export type ReactionTargetType = (typeof REACTION_TARGET_TYPES)[number]

export type ReactionRecord = {
  id: string
  actorUserId: string
  targetType: ReactionTargetType
  targetId: string
  kind: ReactionKind
  createdAt: Date
  updatedAt: Date
}

export type ReactionRefuseReason =
  | 'invalid'
  | 'invalid_kind'
  | 'disabled_kind'
  | 'cannot_view'
  | 'cannot_interact'

export type ReactionMutationResult =
  | { ok: true; reaction: ReactionRecord }
  | { ok: false; reason: ReactionRefuseReason }

export type ReactionDecision =
  | {
      ok: true
      write: 'insert' | 'update' | 'noop'
      reaction: ReactionRecord
    }
  | { ok: false; reason: ReactionRefuseReason }

export type SetPostLikeInput = {
  actorUserId: string
  postId: string
  /** Must be an enabled catalog kind. Unknown → invalid_kind; disabled → disabled_kind. */
  kind: string
}

export type SetCommentLikeInput = {
  actorUserId: string
  commentId: string
  /** Must be an enabled catalog kind. Unknown → invalid_kind; disabled → disabled_kind. */
  kind: string
}

export function isReactionKind(value: string): value is ReactionKind {
  return (REACTION_KINDS as readonly string[]).includes(value)
}

export function isReactionTargetType(value: string): value is ReactionTargetType {
  return (REACTION_TARGET_TYPES as readonly string[]).includes(value)
}

/**
 * True when `kind` is in the catalog and listed in `enabledKinds`.
 * Defaults to only `like` enabled.
 */
export function isReactionKindEnabled(
  kind: string,
  enabledKinds: readonly string[] = DEFAULT_ENABLED_REACTION_KINDS,
): boolean {
  if (!isReactionKind(kind)) return false
  return (enabledKinds as readonly string[]).includes(kind)
}

/**
 * Normalize an enabled-kinds list: keep catalog members only, dedupe, keep order.
 * Empty / missing → default (`like` only). `like` cannot be turned off.
 */
export function normalizeEnabledReactionKinds(
  raw: unknown,
): ReactionKind[] {
  const list = Array.isArray(raw)
    ? raw.map((v) => String(v ?? '').trim()).filter(Boolean)
    : []
  const seen = new Set<string>()
  const out: ReactionKind[] = []
  for (const kind of list) {
    if (!isReactionKind(kind) || seen.has(kind)) continue
    seen.add(kind)
    out.push(kind)
  }
  if (!seen.has('like')) {
    out.unshift('like')
  }
  return out.length > 0 ? out : [...DEFAULT_ENABLED_REACTION_KINDS]
}

/** Keep safe CSS class tokens only (FA class lists). Empty → ''. */
export function sanitizeReactionIconClass(raw: unknown): string {
  const text = String(raw ?? '').trim()
  if (!text) return ''
  const tokens = text
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => /^[a-zA-Z0-9_-]+$/.test(token))
  return tokens.join(' ')
}

/**
 * Full icon map for every catalog kind.
 * Missing / empty / unsafe → that kind’s Font Awesome default.
 */
export function normalizeReactionIcons(raw: unknown): ReactionIcons {
  const source =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {}
  const out = { ...DEFAULT_REACTION_ICONS }
  for (const kind of REACTION_KINDS) {
    const cleaned = sanitizeReactionIconClass(source[kind])
    out[kind] = cleaned || DEFAULT_REACTION_ICONS[kind]
  }
  return out
}

/** Keep a CSS hex color only. Empty / invalid → ''. */
export function sanitizeReactionIconColor(raw: unknown): string {
  const text = String(raw ?? '').trim()
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(text)) return ''
  return text.toLowerCase()
}

/**
 * Full color map for every catalog kind.
 * Missing / empty / unsafe → that kind’s default tint.
 */
export function normalizeReactionIconColors(raw: unknown): ReactionIconColors {
  const source =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {}
  const out = { ...DEFAULT_REACTION_ICON_COLORS }
  for (const kind of REACTION_KINDS) {
    const cleaned = sanitizeReactionIconColor(source[kind])
    out[kind] = cleaned || DEFAULT_REACTION_ICON_COLORS[kind]
  }
  return out
}

/** Safe media id token. Empty / unsafe → ''. */
export function sanitizeReactionIconMediaId(raw: unknown): string {
  const text = String(raw ?? '').trim()
  if (!text) return ''
  if (!/^[a-zA-Z0-9_-]+$/.test(text)) return ''
  return text
}

/** Media id per kind. Empty string = use FA class. */
export function normalizeReactionIconMediaIds(raw: unknown): ReactionIconMediaIds {
  const source =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {}
  const out = {} as ReactionIconMediaIds
  for (const kind of REACTION_KINDS) {
    out[kind] = sanitizeReactionIconMediaId(source[kind])
  }
  return out
}

function reactionMapKey(
  actorUserId: string,
  targetType: ReactionTargetType,
  targetId: string,
): string {
  return `${actorUserId}\0${targetType}\0${targetId}`
}

/**
 * Decide the next reaction row for a post reaction.
 * Callers pass canView / canInteract results; this does not re-derive them.
 * `enabledKinds` defaults to only `like`.
 */
export function decidePostLike(
  current: ReactionRecord | null,
  input: SetPostLikeInput,
  gates: { canView: boolean; canInteract: boolean },
  opts?: {
    now?: Date
    newId?: () => string
    enabledKinds?: readonly string[]
  },
): ReactionDecision {
  const actorUserId = input.actorUserId.trim()
  const postId = input.postId.trim()
  if (!actorUserId || !postId) return { ok: false, reason: 'invalid' }

  const kindRaw = (input.kind ?? '').trim()
  if (!isReactionKind(kindRaw)) return { ok: false, reason: 'invalid_kind' }

  const enabled = normalizeEnabledReactionKinds(
    opts?.enabledKinds ?? DEFAULT_ENABLED_REACTION_KINDS,
  )
  if (!isReactionKindEnabled(kindRaw, enabled)) {
    return { ok: false, reason: 'disabled_kind' }
  }

  if (!gates.canView) return { ok: false, reason: 'cannot_view' }
  if (!gates.canInteract) return { ok: false, reason: 'cannot_interact' }

  const now = opts?.now ?? new Date()
  const newId = opts?.newId ?? (() => crypto.randomUUID())

  if (current) {
    if (
      current.actorUserId !== actorUserId ||
      current.targetType !== 'post' ||
      current.targetId !== postId
    ) {
      return { ok: false, reason: 'invalid' }
    }
    if (current.kind === kindRaw) {
      return { ok: true, write: 'noop', reaction: current }
    }
    // Unique key is per target, not per kind — update the open row.
    const next: ReactionRecord = {
      ...current,
      kind: kindRaw,
      updatedAt: now,
    }
    return { ok: true, write: 'update', reaction: next }
  }

  return {
    ok: true,
    write: 'insert',
    reaction: {
      id: newId(),
      actorUserId,
      targetType: 'post',
      targetId: postId,
      kind: kindRaw,
      createdAt: now,
      updatedAt: now,
    },
  }
}

/**
 * React to a post after resolving canViewPost + canInteract for the author.
 * Used by in-memory tests and as the pure core of the DB path.
 */
export function setPostLikeWithGates(
  current: ReactionRecord | null,
  input: SetPostLikeInput,
  opts: {
    post: PostRecord | null
    viewCtx: CanViewPostContext
    interactCtx: CanInteractContext
    now?: Date
    newId?: () => string
    enabledKinds?: readonly string[]
  },
): ReactionDecision {
  if (!opts.post || opts.post.id.trim() !== input.postId.trim()) {
    return { ok: false, reason: 'cannot_view' }
  }
  const canView = canViewPost(opts.post, opts.viewCtx)
  const interactOk = canInteract(
    input.actorUserId,
    opts.post.authorUserId,
    opts.interactCtx,
  )
  return decidePostLike(current, input, { canView, canInteract: interactOk }, {
    now: opts.now,
    newId: opts.newId,
    enabledKinds: opts.enabledKinds,
  })
}

/**
 * Decide a reaction on a comment. Same unique row as a post reaction.
 * Pack switch off → disabled_kind. A reply is still one comment row.
 */
export function decideCommentLike(
  current: ReactionRecord | null,
  input: SetCommentLikeInput,
  gates: { canView: boolean; canInteract: boolean; reactionsOnComments: boolean },
  opts?: {
    now?: Date
    newId?: () => string
    enabledKinds?: readonly string[]
  },
): ReactionDecision {
  const actorUserId = input.actorUserId.trim()
  const commentId = input.commentId.trim()
  if (!actorUserId || !commentId) return { ok: false, reason: 'invalid' }
  if (!gates.reactionsOnComments) return { ok: false, reason: 'disabled_kind' }

  const kindRaw = (input.kind ?? '').trim()
  if (!isReactionKind(kindRaw)) return { ok: false, reason: 'invalid_kind' }

  const enabled = normalizeEnabledReactionKinds(
    opts?.enabledKinds ?? DEFAULT_ENABLED_REACTION_KINDS,
  )
  if (!isReactionKindEnabled(kindRaw, enabled)) {
    return { ok: false, reason: 'disabled_kind' }
  }

  if (!gates.canView) return { ok: false, reason: 'cannot_view' }
  if (!gates.canInteract) return { ok: false, reason: 'cannot_interact' }

  const now = opts?.now ?? new Date()
  const newId = opts?.newId ?? (() => crypto.randomUUID())

  if (current) {
    if (
      current.actorUserId !== actorUserId ||
      current.targetType !== 'comment' ||
      current.targetId !== commentId
    ) {
      return { ok: false, reason: 'invalid' }
    }
    if (current.kind === kindRaw) {
      return { ok: true, write: 'noop', reaction: current }
    }
    return {
      ok: true,
      write: 'update',
      reaction: { ...current, kind: kindRaw, updatedAt: now },
    }
  }

  return {
    ok: true,
    write: 'insert',
    reaction: {
      id: newId(),
      actorUserId,
      targetType: 'comment',
      targetId: commentId,
      kind: kindRaw,
      createdAt: now,
      updatedAt: now,
    },
  }
}

export type ClearReactionDecision =
  | { ok: true; write: 'delete'; reaction: ReactionRecord }
  | { ok: true; write: 'noop' }
  | { ok: false; reason: ReactionRefuseReason }

/**
 * Remove the viewer's one reaction on a post or comment.
 * No row is a noop. Same view and interact gates as setting a reaction.
 * The pack switch does not block a clear, so a member can take a reaction off
 * after reactions on comments are turned off.
 */
export function decideClearReaction(
  current: ReactionRecord | null,
  input: {
    actorUserId: string
    targetType: ReactionTargetType
    targetId: string
  },
  gates: { canView: boolean; canInteract: boolean },
): ClearReactionDecision {
  const actorUserId = input.actorUserId.trim()
  const targetId = input.targetId.trim()
  if (!actorUserId || !targetId || !isReactionTargetType(input.targetType)) {
    return { ok: false, reason: 'invalid' }
  }
  if (!gates.canView) return { ok: false, reason: 'cannot_view' }
  if (!gates.canInteract) return { ok: false, reason: 'cannot_interact' }
  if (!current) return { ok: true, write: 'noop' }
  if (
    current.actorUserId !== actorUserId ||
    current.targetType !== input.targetType ||
    current.targetId !== targetId
  ) {
    return { ok: false, reason: 'invalid' }
  }
  return { ok: true, write: 'delete', reaction: current }
}

/** In-memory reactions with the same unique (actor, targetType, targetId) rule. */
export function createReactionMemory(opts?: {
  newId?: () => string
  now?: () => Date
  enabledKinds?: readonly string[]
}): {
  get: (
    actorUserId: string,
    targetType: ReactionTargetType,
    targetId: string,
  ) => ReactionRecord | null
  likePost: (
    input: SetPostLikeInput,
    gates: {
      post: PostRecord | null
      viewCtx: CanViewPostContext
      interactCtx: CanInteractContext
    },
  ) => ReactionMutationResult
} {
  const rows = new Map<string, ReactionRecord>()
  const newId = opts?.newId ?? (() => crypto.randomUUID())
  const now = opts?.now ?? (() => new Date())
  const enabledKinds = opts?.enabledKinds

  return {
    get: (actorUserId, targetType, targetId) => {
      const actor = actorUserId.trim()
      const id = targetId.trim()
      if (!actor || !id) return null
      return rows.get(reactionMapKey(actor, targetType, id)) ?? null
    },
    likePost: (input, gates) => {
      const actor = input.actorUserId.trim()
      const postId = input.postId.trim()
      const current =
        actor && postId
          ? (rows.get(reactionMapKey(actor, 'post', postId)) ?? null)
          : null
      const decision = setPostLikeWithGates(current, input, {
        ...gates,
        now: now(),
        newId,
        enabledKinds,
      })
      if (!decision.ok) return { ok: false, reason: decision.reason }
      if (decision.write === 'insert' || decision.write === 'update') {
        rows.set(
          reactionMapKey(
            decision.reaction.actorUserId,
            decision.reaction.targetType,
            decision.reaction.targetId,
          ),
          decision.reaction,
        )
      }
      return { ok: true, reaction: decision.reaction }
    },
  }
}
