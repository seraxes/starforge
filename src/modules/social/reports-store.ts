/**
 * product:social report persistence (sf_social_reports).
 * postId required; optional commentId on the same post.
 * One open row per (reporterUserId, postId) — second flag updates that row.
 */

import 'server-only'

import { and, asc, count, eq } from 'drizzle-orm'

import { db } from '@/core/db'

import { findComment, setCommentStaffHidden } from './comments-store'
import { canViewerSeePost, findPost, setPostStaffHidden } from './posts-store'
import {
  decideCreateReport,
  decideResolveReport,
  isReportReason,
  isReportStatus,
  type CreateReportInput,
  type ReportMutationResult,
  type ReportRecord,
  type ResolveReportDecision,
  type ResolveReportInput,
} from './reports'
import { sfSocialReports } from './schema'

function mapRow(row: typeof sfSocialReports.$inferSelect): ReportRecord | null {
  if (!isReportReason(row.reason) || !isReportStatus(row.status)) return null
  return {
    id: row.id,
    postId: row.postId,
    commentId: row.commentId,
    reporterUserId: row.reporterUserId,
    reason: row.reason,
    note: row.note,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function findReport(reportId: string): Promise<ReportRecord | null> {
  const id = reportId.trim()
  if (!id) return null
  try {
    const rows = await db
      .select()
      .from(sfSocialReports)
      .where(eq(sfSocialReports.id, id))
      .limit(1)
    return rows[0] ? mapRow(rows[0]) : null
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_reports|does not exist|relation/i.test(msg)) return null
    throw error
  }
}

export async function findOpenReport(
  reporterUserId: string,
  postId: string,
): Promise<ReportRecord | null> {
  const reporter = reporterUserId.trim()
  const id = postId.trim()
  if (!reporter || !id) return null
  try {
    const rows = await db
      .select()
      .from(sfSocialReports)
      .where(
        and(
          eq(sfSocialReports.reporterUserId, reporter),
          eq(sfSocialReports.postId, id),
          eq(sfSocialReports.status, 'open'),
        ),
      )
      .limit(1)
    return rows[0] ? mapRow(rows[0]) : null
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_reports|does not exist|relation/i.test(msg)) return null
    throw error
  }
}

/**
 * Create or update an open report.
 * Named failure: missing postId or unknown post → no_post.
 * Refuses when canViewPost denies (including block).
 */
export async function createReport(
  input: CreateReportInput,
  extras?: {
    view?: Parameters<typeof canViewerSeePost>[2]
  },
): Promise<ReportMutationResult> {
  const reporter = input.reporterUserId.trim()
  if (!reporter) return { ok: false, reason: 'invalid' }

  const postId = (input.postId ?? '').trim()
  if (!postId) return { ok: false, reason: 'no_post' }

  const post = await findPost(postId)
  if (!post) return { ok: false, reason: 'no_post' }

  const commentId = input.commentId?.trim() || null
  const comment = commentId ? await findComment(commentId) : null

  const canView = await canViewerSeePost(reporter, post, extras?.view)
  const currentOpen = await findOpenReport(reporter, postId)
  const { loadSocialModuleSettings } = await import('./settings')
  const { shouldAutoHideFromOpenReports } = await import('./pack-settings')
  const pack = await loadSocialModuleSettings()
  const decision = decideCreateReport(
    currentOpen,
    input,
    { canView, comment },
    { enabledReasons: pack.settings.enabledReportReasons },
  )
  if (!decision.ok) return { ok: false, reason: decision.reason }

  if (decision.write === 'noop') {
    return { ok: true, report: decision.report }
  }

  const next = decision.report
  try {
    if (decision.write === 'insert') {
      await db.insert(sfSocialReports).values({
        id: next.id,
        postId: next.postId,
        commentId: next.commentId,
        reporterUserId: next.reporterUserId,
        reason: next.reason,
        note: next.note,
        status: next.status,
        createdAt: next.createdAt,
        updatedAt: next.updatedAt,
      })
    } else {
      await db
        .update(sfSocialReports)
        .set({
          commentId: next.commentId,
          reason: next.reason,
          note: next.note,
          updatedAt: next.updatedAt,
        })
        .where(eq(sfSocialReports.id, next.id))
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_reports|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'invalid' }
    }
    throw error
  }

  const openCount = await countOpenReportsForPost(postId)
  if (
    shouldAutoHideFromOpenReports(
      openCount,
      pack.settings.autoHideOpenReportThreshold,
    ) &&
    !post.staffHidden
  ) {
    await setPostStaffHidden(
      {
        actorUserId: reporter,
        postId,
        staffHidden: true,
      },
      { canManagePosts: true },
    )
  }

  const stored = await findReport(next.id)
  return stored ? { ok: true, report: stored } : { ok: true, report: next }
}

/** Open report rows for one post (auto-hide threshold). */
export async function countOpenReportsForPost(postId: string): Promise<number> {
  const id = postId.trim()
  if (!id) return 0
  try {
    const rows = await db
      .select({ value: count() })
      .from(sfSocialReports)
      .where(
        and(eq(sfSocialReports.postId, id), eq(sfSocialReports.status, 'open')),
      )
    return Number(rows[0]?.value ?? 0)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_reports|does not exist|relation/i.test(msg)) return 0
    throw error
  }
}

/** Open reports for the review queue (oldest first). */
export async function listOpenReports(opts?: {
  limit?: number
}): Promise<ReportRecord[]> {
  const limit = Math.min(Math.max(opts?.limit ?? 100, 1), 500)
  try {
    const rows = await db
      .select()
      .from(sfSocialReports)
      .where(eq(sfSocialReports.status, 'open'))
      .orderBy(asc(sfSocialReports.createdAt))
      .limit(limit)
    return rows.map(mapRow).filter((row): row is ReportRecord => row != null)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_reports|does not exist|relation/i.test(msg)) return []
    throw error
  }
}

/**
 * Resolve an open report. Requires social.reports manage.
 * status hidden → also staff-hides the post or named comment (social.posts manage).
 */
export async function resolveReport(
  input: ResolveReportInput,
  gates: { canManageReports: boolean; canManagePosts?: boolean },
): Promise<ResolveReportDecision> {
  const current = await findReport(input.reportId)
  const decision = decideResolveReport(current, input, {
    canManageReports: gates.canManageReports,
  })
  if (!decision.ok) return decision

  const next = decision.report
  try {
    await db
      .update(sfSocialReports)
      .set({
        status: next.status,
        updatedAt: next.updatedAt,
      })
      .where(eq(sfSocialReports.id, next.id))
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_social_reports|does not exist|relation/i.test(msg)) {
      return { ok: false, reason: 'invalid' }
    }
    throw error
  }

  const canManagePosts = gates.canManagePosts ?? gates.canManageReports
  if (decision.hidePost) {
    await setPostStaffHidden(
      {
        actorUserId: input.actorUserId,
        postId: next.postId,
        staffHidden: true,
      },
      { canManagePosts },
    )
  } else if (decision.hideCommentId) {
    await setCommentStaffHidden(
      {
        actorUserId: input.actorUserId,
        commentId: decision.hideCommentId,
        staffHidden: true,
      },
      { canManagePosts },
    )
  }

  const stored = await findReport(next.id)
  return {
    ok: true,
    report: stored ?? next,
    hidePost: decision.hidePost,
    hideCommentId: decision.hideCommentId,
  }
}
