import 'server-only'

import { randomUUID } from 'node:crypto'

import { db, sfAdminAudit } from '@/core/db'

import { normalizeAdminAuditInput, type AdminAuditInput } from './entries'

/**
 * Append one admin-audit row after a mutation has already succeeded.
 * Do not call this on a failed change. There is no update or delete.
 */
export async function recordAdminAudit(input: AdminAuditInput): Promise<void> {
  const row = normalizeAdminAuditInput(input)
  await db.insert(sfAdminAudit).values({
    id: randomUUID(),
    actorUserId: row.actorId,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
  })
}
