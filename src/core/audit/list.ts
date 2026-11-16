import 'server-only'

import { and, desc, eq, gte, ilike, lte, or, type SQL } from 'drizzle-orm'

import { db, sfAdminAudit, sfUsers } from '@/core/db'

export const ADMIN_AUDIT_LIST_LIMIT = 200

export type AdminAuditListRow = {
  id: string
  actorUserId: string
  actorName: string | null
  actorEmail: string | null
  action: string
  targetType: string
  targetId: string
  createdAt: Date
}

export class AdminAuditUnavailableError extends Error {
  constructor() {
    super('Audit table missing — run npm run db:migrate.')
    this.name = 'AdminAuditUnavailableError'
  }
}

function isMissingAuditTable(error: unknown): boolean {
  const seen = new Set<unknown>()
  let current: unknown = error
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current)
    const code = 'code' in current ? String((current as { code?: unknown }).code) : ''
    if (code === '42P01') return true
    const message = current instanceof Error ? current.message : ''
    if (/sf_admin_audit/i.test(message) && /does not exist/i.test(message)) return true
    current = 'cause' in current ? (current as { cause?: unknown }).cause : undefined
  }
  return false
}

export type AdminAuditQuery = {
  limit?: number
  /** Action key or prefix, e.g. `event.` or `acl.manage`. */
  action?: string
  targetType?: string
  /** Actor id, name, or email fragment. */
  actor?: string
  /** Inclusive UTC day `YYYY-MM-DD`. */
  from?: string
  /** Inclusive UTC day `YYYY-MM-DD`. */
  to?: string
}

const ACTION_FILTER = /^[a-z][a-z0-9.-]{0,80}$/
const TYPE_FILTER = /^[a-z][a-z-]{0,31}$/
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/

function capLimit(limit: number | undefined, fallback: number): number {
  const raw = Math.floor(limit ?? fallback)
  if (!Number.isFinite(raw)) return fallback
  return Math.min(Math.max(raw, 1), 2000)
}

function parseDay(value: string | undefined, end: boolean): Date | null {
  const trimmed = value?.trim() ?? ''
  const match = DAY.exec(trimmed)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = end
    ? new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999))
    : new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
  return Number.isNaN(date.getTime()) ? null : date
}

function actorNeedle(value: string | undefined): string | null {
  const trimmed = value?.trim().slice(0, 80) ?? ''
  if (!trimmed) return null
  const safe = trimmed.replace(/[%_\\]/g, '')
  return safe || null
}

/** Newest first. Read-only. Actor name/email are joined for display and are not stored on the row. */
export async function listAdminAudit(
  limitOrQuery: number | AdminAuditQuery = ADMIN_AUDIT_LIST_LIMIT,
): Promise<AdminAuditListRow[]> {
  const query: AdminAuditQuery =
    typeof limitOrQuery === 'number' ? { limit: limitOrQuery } : limitOrQuery
  const cap = capLimit(query.limit, ADMIN_AUDIT_LIST_LIMIT)
  const filters: SQL[] = []
  const action = query.action?.trim().toLowerCase() ?? ''
  if (action && ACTION_FILTER.test(action)) {
    filters.push(ilike(sfAdminAudit.action, `${action}%`))
  }
  const targetType = query.targetType?.trim().toLowerCase() ?? ''
  if (targetType && TYPE_FILTER.test(targetType)) {
    filters.push(eq(sfAdminAudit.targetType, targetType))
  }
  const actor = actorNeedle(query.actor)
  if (actor) {
    const like = `%${actor}%`
    const actorMatch = or(
      eq(sfAdminAudit.actorUserId, actor),
      ilike(sfUsers.name, like),
      ilike(sfUsers.email, like),
    )
    if (actorMatch) filters.push(actorMatch)
  }
  const from = parseDay(query.from, false)
  const to = parseDay(query.to, true)
  if (from) filters.push(gte(sfAdminAudit.createdAt, from))
  if (to) filters.push(lte(sfAdminAudit.createdAt, to))

  try {
    return await db
      .select({
        id: sfAdminAudit.id,
        actorUserId: sfAdminAudit.actorUserId,
        actorName: sfUsers.name,
        actorEmail: sfUsers.email,
        action: sfAdminAudit.action,
        targetType: sfAdminAudit.targetType,
        targetId: sfAdminAudit.targetId,
        createdAt: sfAdminAudit.createdAt,
      })
      .from(sfAdminAudit)
      .leftJoin(sfUsers, eq(sfUsers.id, sfAdminAudit.actorUserId))
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(desc(sfAdminAudit.createdAt), desc(sfAdminAudit.id))
      .limit(cap)
  } catch (error) {
    if (isMissingAuditTable(error)) throw new AdminAuditUnavailableError()
    throw error
  }
}
