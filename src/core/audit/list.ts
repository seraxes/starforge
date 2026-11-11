import 'server-only'

import { desc, eq } from 'drizzle-orm'

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

/** Newest first. Read-only. Actor name/email are joined for display and are not stored on the row. */
export async function listAdminAudit(
  limit = ADMIN_AUDIT_LIST_LIMIT,
): Promise<AdminAuditListRow[]> {
  const cap = Math.min(Math.max(Math.floor(limit) || ADMIN_AUDIT_LIST_LIMIT, 1), 500)
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
      .orderBy(desc(sfAdminAudit.createdAt), desc(sfAdminAudit.id))
      .limit(cap)
  } catch (error) {
    if (isMissingAuditTable(error)) throw new AdminAuditUnavailableError()
    throw error
  }
}
