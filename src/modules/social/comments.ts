/**
 * product:social comments — visual two-level replies.
 *
 * Create calls canViewPost + canInteract (slice 6). It does not re-derive them.
 * Any comment or reply may be answered. The card draws replies one step under
 * the top comment and names who a nested reply answers. The comment author may
 * edit or delete their own. The post author may delete any comment on that
 * post. Deleting a comment deletes the replies under it. DB persistence
 * lives in comments-store.ts.
 */

import { canInteract, type CanInteractContext } from './interact'
import {
  canViewPost,
  isEmptyPostBody,
  type CanViewPostContext,
  type PostRecord,
} from './posts'

export type CommentRecord = {
  id: string
  postId: string
  authorUserId: string
  body: string
  parentCommentId: string | null
  staffHidden: boolean
  editedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type CommentRefuseReason =
  | 'invalid'
  | 'empty_body'
  | 'cannot_view'
  | 'cannot_interact'
  | 'parent_not_found'
  | 'not_found'
  | 'not_author'
  | 'cannot_manage'
  /** Pack allowComments switch is off. */
  | 'disabled'
  /** Body longer than pack commentLengthLimit. */
  | 'too_long'
  /** Pack blocked-words list matched the body (slice 15c). */
  | 'blocked_word'

export type StaffHideCommentInput = {
  actorUserId: string
  commentId: string
  staffHidden: boolean
}

export type CommentMutationResult =
  | { ok: true; comment: CommentRecord }
  | { ok: false; reason: CommentRefuseReason }

export type CommentDeleteResult =
  | { ok: true; deletedIds: string[] }
  | { ok: false; reason: CommentRefuseReason }

export type CreateCommentInput = {
  authorUserId: string
  postId: string
  body?: string
  /** Reply target — any existing comment on the same post. */
  parentCommentId?: string | null
}

export type EditCommentInput = {
  actorUserId: string
  commentId: string
  body?: string
}

export type DeleteCommentInput = {
  actorUserId: string
  commentId: string
}

export type CommentDecision =
  | { ok: true; write: 'insert'; comment: CommentRecord }
  | { ok: false; reason: CommentRefuseReason }

/**
 * Decide a new comment / reply row.
 * Callers pass canView / canInteract results; this does not re-derive them.
 * Any existing comment on the post may be the reply parent — visual depth is
 * capped in the conversation UI, not here.
 */
export function decideCreateComment(
  input: CreateCommentInput,
  gates: {
    canView: boolean
    canInteract: boolean
    /** Parent row when parentCommentId is set; null when missing. */
    parent: CommentRecord | null
  },
  opts?: {
    now?: Date
    newId?: () => string
    /** Pack allowComments. false → disabled. */
    commentsEnabled?: boolean
    /** Pack commentLengthLimit. Omit → no length check. */
    commentLengthLimit?: number
    /** Pack blockedWords. Matching body → blocked_word. */
    blockedWords?: readonly string[]
  },
): CommentDecision {
  const authorUserId = input.authorUserId.trim()
  const postId = input.postId.trim()
  if (!authorUserId || !postId) return { ok: false, reason: 'invalid' }

  if (opts?.commentsEnabled === false) return { ok: false, reason: 'disabled' }

  const body = (input.body ?? '').trim()
  if (isEmptyPostBody(body)) return { ok: false, reason: 'empty_body' }
  if (
    typeof opts?.commentLengthLimit === 'number' &&
    Number.isInteger(opts.commentLengthLimit) &&
    opts.commentLengthLimit > 0 &&
    body.length > opts.commentLengthLimit
  ) {
    return { ok: false, reason: 'too_long' }
  }
  if (opts?.blockedWords?.length) {
    const hay = body.toLowerCase()
    for (const word of opts.blockedWords) {
      const needle = word.trim().toLowerCase()
      if (needle && hay.includes(needle)) return { ok: false, reason: 'blocked_word' }
    }
  }

  if (!gates.canView) return { ok: false, reason: 'cannot_view' }
  if (!gates.canInteract) return { ok: false, reason: 'cannot_interact' }

  const parentCommentId = input.parentCommentId?.trim() || null
  if (parentCommentId) {
    if (!gates.parent || gates.parent.id !== parentCommentId) {
      return { ok: false, reason: 'parent_not_found' }
    }
    if (gates.parent.postId !== postId) {
      return { ok: false, reason: 'parent_not_found' }
    }
  }

  const now = opts?.now ?? new Date()
  const newId = opts?.newId ?? (() => crypto.randomUUID())

  return {
    ok: true,
    write: 'insert',
    comment: {
      id: newId(),
      postId,
      authorUserId,
      body,
      parentCommentId,
      staffHidden: false,
      editedAt: null,
      createdAt: now,
      updatedAt: now,
    },
  }
}

/**
 * Create a comment after resolving canViewPost + canInteract for the post author.
 */
export function createCommentWithGates(
  input: CreateCommentInput,
  opts: {
    post: PostRecord | null
    parent: CommentRecord | null
    viewCtx: CanViewPostContext
    interactCtx: CanInteractContext
    now?: Date
    newId?: () => string
  },
): CommentDecision {
  if (!opts.post || opts.post.id.trim() !== input.postId.trim()) {
    return { ok: false, reason: 'cannot_view' }
  }
  const canView = canViewPost(opts.post, opts.viewCtx)
  const interactOk = canInteract(
    input.authorUserId,
    opts.post.authorUserId,
    opts.interactCtx,
  )
  return decideCreateComment(
    input,
    { canView, canInteract: interactOk, parent: opts.parent },
    { now: opts.now, newId: opts.newId },
  )
}

/**
 * Edit a comment body.
 * Author always may. Social staff with canManagePosts may edit any comment.
 */
export function decideEditComment(
  current: CommentRecord | null,
  input: EditCommentInput,
  opts?: { now?: Date; canManagePosts?: boolean },
): CommentMutationResult {
  if (!current) return { ok: false, reason: 'not_found' }
  const actor = input.actorUserId.trim()
  if (!actor) return { ok: false, reason: 'invalid' }
  const isAuthor = current.authorUserId === actor
  if (!isAuthor && !opts?.canManagePosts) return { ok: false, reason: 'not_author' }

  const body = (input.body ?? '').trim()
  if (isEmptyPostBody(body)) return { ok: false, reason: 'empty_body' }

  const now = opts?.now ?? new Date()
  return {
    ok: true,
    comment: {
      ...current,
      body,
      editedAt: now,
      updatedAt: now,
    },
  }
}

/**
 * Delete a comment.
 * The comment author may. The post author may delete any comment on their post.
 * Social staff with canManagePosts may delete any comment.
 * Returns the comment id plus reply ids under it (direct and nested).
 */
export function decideDeleteComment(
  current: CommentRecord | null,
  input: DeleteCommentInput,
  replyIds: string[],
  opts?: { canManagePosts?: boolean; postAuthorUserId?: string | null },
): CommentDeleteResult {
  if (!current) return { ok: false, reason: 'not_found' }
  const actor = input.actorUserId.trim()
  if (!actor) return { ok: false, reason: 'invalid' }
  const isAuthor = current.authorUserId === actor
  const isPostAuthor = Boolean(opts?.postAuthorUserId?.trim()) && opts?.postAuthorUserId?.trim() === actor
  if (!isAuthor && !isPostAuthor && !opts?.canManagePosts) return { ok: false, reason: 'not_author' }

  const deletedIds = [current.id, ...replyIds.filter((id) => id.trim() && id !== current.id)]
  return { ok: true, deletedIds }
}

/**
 * Staff hide / restore a comment. Requires social.posts manage.
 * Author still sees their own row via canViewComment.
 */
export function decideStaffHideComment(
  current: CommentRecord | null,
  input: StaffHideCommentInput,
  gates: { canManagePosts: boolean },
  opts?: { now?: Date },
): CommentMutationResult {
  if (!current) return { ok: false, reason: 'not_found' }
  const actor = input.actorUserId.trim()
  if (!actor || current.id.trim() !== input.commentId.trim()) {
    return { ok: false, reason: 'invalid' }
  }
  if (!gates.canManagePosts) return { ok: false, reason: 'cannot_manage' }

  const now = opts?.now ?? new Date()
  return {
    ok: true,
    comment: {
      ...current,
      staffHidden: Boolean(input.staffHidden),
      updatedAt: now,
    },
  }
}

/**
 * Whether a viewer may read a comment. Author always sees their own.
 * Staff-hidden comments need social.posts manage.
 */
export function canViewComment(
  comment: CommentRecord,
  ctx: { viewerUserId: string | null; canManagePosts: boolean },
): boolean {
  const viewer = ctx.viewerUserId?.trim() || null
  if (viewer && viewer === comment.authorUserId) return true
  if (comment.staffHidden && !ctx.canManagePosts) return false
  return true
}

/** In-memory comments with the same parent rules as the DB path. */
export function createCommentMemory(opts?: {
  newId?: () => string
  now?: () => Date
}): {
  get: (commentId: string) => CommentRecord | null
  listForPost: (postId: string) => CommentRecord[]
  listReplies: (parentCommentId: string) => CommentRecord[]
  create: (
    input: CreateCommentInput,
    gates: {
      post: PostRecord | null
      viewCtx: CanViewPostContext
      interactCtx: CanInteractContext
    },
  ) => CommentMutationResult
  edit: (
    input: EditCommentInput,
    gates?: { canManagePosts?: boolean },
  ) => CommentMutationResult
  delete: (
    input: DeleteCommentInput,
    gates?: { canManagePosts?: boolean; postAuthorUserId?: string | null },
  ) => CommentDeleteResult
  setStaffHidden: (
    input: StaffHideCommentInput,
    gates: { canManagePosts: boolean },
  ) => CommentMutationResult
  /** Test / cascade helper — drop every comment on a post. */
  deleteForPost: (postId: string) => string[]
} {
  const rows = new Map<string, CommentRecord>()
  const newId = opts?.newId ?? (() => crypto.randomUUID())
  const now = opts?.now ?? (() => new Date())

  function descendantIds(rootId: string): string[] {
    const out: string[] = []
    const walk = (parentId: string) => {
      for (const row of rows.values()) {
        if (row.parentCommentId !== parentId) continue
        out.push(row.id)
        walk(row.id)
      }
    }
    walk(rootId)
    return out
  }

  return {
    get: (commentId) => rows.get(commentId.trim()) ?? null,
    listForPost: (postId) => {
      const id = postId.trim()
      if (!id) return []
      return [...rows.values()]
        .filter((row) => row.postId === id)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    },
    listReplies: (parentCommentId) => {
      const id = parentCommentId.trim()
      if (!id) return []
      return [...rows.values()].filter((row) => row.parentCommentId === id)
    },
    create: (input, gates) => {
      const parentId = input.parentCommentId?.trim() || null
      const parent = parentId ? (rows.get(parentId) ?? null) : null
      const decision = createCommentWithGates(input, {
        ...gates,
        parent,
        now: now(),
        newId,
      })
      if (!decision.ok) return { ok: false, reason: decision.reason }
      rows.set(decision.comment.id, decision.comment)
      return { ok: true, comment: decision.comment }
    },
    edit: (input, gates) => {
      const current = rows.get(input.commentId.trim()) ?? null
      const result = decideEditComment(current, input, {
        now: now(),
        canManagePosts: gates?.canManagePosts,
      })
      if (!result.ok) return result
      rows.set(result.comment.id, result.comment)
      return result
    },
    delete: (input, gates) => {
      const current = rows.get(input.commentId.trim()) ?? null
      const nested = current ? descendantIds(current.id) : []
      const result = decideDeleteComment(current, input, nested, {
        canManagePosts: gates?.canManagePosts,
        postAuthorUserId: gates?.postAuthorUserId,
      })
      if (!result.ok) return result
      for (const id of result.deletedIds) rows.delete(id)
      return result
    },
    setStaffHidden: (input, gates) => {
      const current = rows.get(input.commentId.trim()) ?? null
      const result = decideStaffHideComment(current, input, gates, { now: now() })
      if (!result.ok) return result
      rows.set(result.comment.id, result.comment)
      return result
    },
    deleteForPost: (postId) => {
      const id = postId.trim()
      const removed: string[] = []
      for (const [key, row] of rows) {
        if (row.postId === id) {
          rows.delete(key)
          removed.push(key)
        }
      }
      return removed
    },
  }
}
