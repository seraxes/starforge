/**
 * product:social reports — abuse flags on a post (optional comment).
 *
 * Every row has postId. commentId is optional and must belong to that post.
 * One open row per (reporterUserId, postId); a second flag updates that row.
 * Create requires canViewPost (block denies via that gate). Stories, groups,
 * and pages have no Report control. Resolve sets status hidden | dismissed.
 * DB persistence lives in reports-store.ts.
 */

import {
  canViewPost,
  type CanViewPostContext,
  type PostRecord,
} from './posts'
import type { CommentRecord } from './comments'

export const REPORT_REASONS = ['spam', 'harassment', 'other'] as const
export type ReportReason = (typeof REPORT_REASONS)[number]

export const REPORT_STATUSES = ['open', 'hidden', 'dismissed'] as const
export type ReportStatus = (typeof REPORT_STATUSES)[number]

export type ReportRecord = {
  id: string
  postId: string
  commentId: string | null
  reporterUserId: string
  reason: ReportReason
  note: string | null
  status: ReportStatus
  createdAt: Date
  updatedAt: Date
}

export type ReportRefuseReason =
  | 'invalid'
  | 'no_post'
  | 'invalid_reason'
  | 'cannot_view'
  | 'comment_not_found'
  | 'not_found'
  | 'not_open'
  | 'cannot_manage'
  | 'invalid_status'

export type ReportMutationResult =
  | { ok: true; report: ReportRecord }
  | { ok: false; reason: ReportRefuseReason }

export type ResolveReportInput = {
  actorUserId: string
  reportId: string
  /** hidden = hide content + close; dismissed = close without hide. */
  status: 'hidden' | 'dismissed' | string
}

export type CreateReportInput = {
  reporterUserId: string
  /** Required — a report always belongs to a post. */
  postId?: string | null
  commentId?: string | null
  reason?: string
  note?: string | null
}

export type ReportDecision =
  | { ok: true; write: 'insert' | 'update' | 'noop'; report: ReportRecord }
  | { ok: false; reason: ReportRefuseReason }

export function isReportReason(value: string): value is ReportReason {
  return (REPORT_REASONS as readonly string[]).includes(value)
}

export function isReportStatus(value: string): value is ReportStatus {
  return (REPORT_STATUSES as readonly string[]).includes(value)
}

function openReportMapKey(reporterUserId: string, postId: string): string {
  return `${reporterUserId}\0${postId}`
}

/**
 * Decide a new or updated open report row.
 * Callers pass canView; this does not re-derive it.
 * Named failure: missing / empty postId → no_post.
 */
export function decideCreateReport(
  currentOpen: ReportRecord | null,
  input: CreateReportInput,
  gates: {
    canView: boolean
    /** Present when commentId is set; null when missing. */
    comment: CommentRecord | null
  },
  opts?: {
    now?: Date
    newId?: () => string
    /** Pack enabledReportReasons. Omit → all catalog reasons. */
    enabledReasons?: readonly string[]
  },
): ReportDecision {
  const reporterUserId = input.reporterUserId.trim()
  if (!reporterUserId) return { ok: false, reason: 'invalid' }

  const postId = (input.postId ?? '').trim()
  if (!postId) return { ok: false, reason: 'no_post' }

  const reasonRaw = (input.reason ?? 'other').trim() || 'other'
  if (!isReportReason(reasonRaw)) return { ok: false, reason: 'invalid_reason' }
  if (
    opts?.enabledReasons &&
    !(opts.enabledReasons as readonly string[]).includes(reasonRaw)
  ) {
    return { ok: false, reason: 'invalid_reason' }
  }

  if (!gates.canView) return { ok: false, reason: 'cannot_view' }

  const commentId = input.commentId?.trim() || null
  if (commentId) {
    if (!gates.comment || gates.comment.id !== commentId) {
      return { ok: false, reason: 'comment_not_found' }
    }
    if (gates.comment.postId !== postId) {
      return { ok: false, reason: 'comment_not_found' }
    }
  }

  const noteRaw = input.note?.trim() || null
  const now = opts?.now ?? new Date()
  const newId = opts?.newId ?? (() => crypto.randomUUID())

  if (currentOpen) {
    if (
      currentOpen.reporterUserId !== reporterUserId ||
      currentOpen.postId !== postId ||
      currentOpen.status !== 'open'
    ) {
      return { ok: false, reason: 'invalid' }
    }
    if (
      currentOpen.reason === reasonRaw &&
      currentOpen.commentId === commentId &&
      currentOpen.note === noteRaw
    ) {
      return { ok: true, write: 'noop', report: currentOpen }
    }
    // Unique open key — update the open row (do not insert a second).
    return {
      ok: true,
      write: 'update',
      report: {
        ...currentOpen,
        commentId,
        reason: reasonRaw,
        note: noteRaw,
        updatedAt: now,
      },
    }
  }

  return {
    ok: true,
    write: 'insert',
    report: {
      id: newId(),
      postId,
      commentId,
      reporterUserId,
      reason: reasonRaw,
      note: noteRaw,
      status: 'open',
      createdAt: now,
      updatedAt: now,
    },
  }
}

/**
 * Create / upsert an open report after resolving canViewPost for the post.
 * Missing post → no_post (named failure).
 */
export function createReportWithGates(
  currentOpen: ReportRecord | null,
  input: CreateReportInput,
  opts: {
    post: PostRecord | null
    comment: CommentRecord | null
    viewCtx: CanViewPostContext
    now?: Date
    newId?: () => string
  },
): ReportDecision {
  const postId = (input.postId ?? '').trim()
  if (!postId) return { ok: false, reason: 'no_post' }
  if (!opts.post || opts.post.id.trim() !== postId) {
    return { ok: false, reason: 'no_post' }
  }
  const canView = canViewPost(opts.post, opts.viewCtx)
  return decideCreateReport(
    currentOpen,
    input,
    { canView, comment: opts.comment },
    { now: opts.now, newId: opts.newId },
  )
}

export type ResolveReportDecision =
  | {
      ok: true
      report: ReportRecord
      /** When status is hidden — hide the post (no commentId). */
      hidePost: boolean
      /** When status is hidden and the report names a comment. */
      hideCommentId: string | null
    }
  | { ok: false; reason: ReportRefuseReason }

/**
 * Resolve an open report (review queue).
 * Requires social.reports manage. Status must be hidden or dismissed.
 * hidden → caller also staff-hides the post or the named comment.
 */
export function decideResolveReport(
  current: ReportRecord | null,
  input: ResolveReportInput,
  gates: { canManageReports: boolean },
  opts?: { now?: Date },
): ResolveReportDecision {
  if (!current) return { ok: false, reason: 'not_found' }
  const actor = input.actorUserId.trim()
  if (!actor || current.id.trim() !== input.reportId.trim()) {
    return { ok: false, reason: 'invalid' }
  }
  if (!gates.canManageReports) return { ok: false, reason: 'cannot_manage' }
  if (current.status !== 'open') return { ok: false, reason: 'not_open' }

  const statusRaw = (input.status ?? '').trim()
  if (statusRaw !== 'hidden' && statusRaw !== 'dismissed') {
    return { ok: false, reason: 'invalid_status' }
  }

  const now = opts?.now ?? new Date()
  const report: ReportRecord = {
    ...current,
    status: statusRaw,
    updatedAt: now,
  }

  if (statusRaw === 'dismissed') {
    return { ok: true, report, hidePost: false, hideCommentId: null }
  }

  if (current.commentId) {
    return { ok: true, report, hidePost: false, hideCommentId: current.commentId }
  }
  return { ok: true, report, hidePost: true, hideCommentId: null }
}

/** In-memory reports with the same one-open-per-reporter-per-post rule. */
export function createReportMemory(opts?: {
  newId?: () => string
  now?: () => Date
}): {
  getOpen: (reporterUserId: string, postId: string) => ReportRecord | null
  get: (reportId: string) => ReportRecord | null
  listOpen: () => ReportRecord[]
  create: (
    input: CreateReportInput,
    gates: {
      post: PostRecord | null
      comment?: CommentRecord | null
      viewCtx: CanViewPostContext
    },
  ) => ReportMutationResult
  resolve: (
    input: ResolveReportInput,
    gates: { canManageReports: boolean },
  ) => ResolveReportDecision
} {
  const byId = new Map<string, ReportRecord>()
  const openByPair = new Map<string, string>()
  const newId = opts?.newId ?? (() => crypto.randomUUID())
  const now = opts?.now ?? (() => new Date())

  function clearOpenIndex(report: ReportRecord) {
    const key = openReportMapKey(report.reporterUserId, report.postId)
    if (openByPair.get(key) === report.id) openByPair.delete(key)
  }

  return {
    get: (reportId) => byId.get(reportId.trim()) ?? null,
    getOpen: (reporterUserId, postId) => {
      const reporter = reporterUserId.trim()
      const id = postId.trim()
      if (!reporter || !id) return null
      const openId = openByPair.get(openReportMapKey(reporter, id))
      return openId ? (byId.get(openId) ?? null) : null
    },
    listOpen: () =>
      [...byId.values()]
        .filter((row) => row.status === 'open')
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
    create: (input, gates) => {
      const reporter = input.reporterUserId.trim()
      const postId = (input.postId ?? '').trim()
      const currentOpen =
        reporter && postId
          ? (() => {
              const openId = openByPair.get(openReportMapKey(reporter, postId))
              return openId ? (byId.get(openId) ?? null) : null
            })()
          : null
      const decision = createReportWithGates(currentOpen, input, {
        post: gates.post,
        comment: gates.comment ?? null,
        viewCtx: gates.viewCtx,
        now: now(),
        newId,
      })
      if (!decision.ok) return { ok: false, reason: decision.reason }
      if (decision.write === 'insert' || decision.write === 'update') {
        byId.set(decision.report.id, decision.report)
        if (decision.report.status === 'open') {
          openByPair.set(
            openReportMapKey(decision.report.reporterUserId, decision.report.postId),
            decision.report.id,
          )
        }
      }
      return { ok: true, report: decision.report }
    },
    resolve: (input, gates) => {
      const current = byId.get(input.reportId.trim()) ?? null
      const decision = decideResolveReport(current, input, gates, { now: now() })
      if (!decision.ok) return decision
      byId.set(decision.report.id, decision.report)
      if (decision.report.status !== 'open') {
        clearOpenIndex(decision.report)
      }
      return decision
    },
  }
}
