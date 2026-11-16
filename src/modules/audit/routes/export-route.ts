import { NextResponse } from 'next/server'

import {
  AdminAuditUnavailableError,
  listAdminAudit,
  requireAuditLogReader,
  type AdminAuditListRow,
} from '@/core/audit'

import { auditQueryFromSearch } from '../query'

export const dynamic = 'force-dynamic'

function cell(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function csvRow(row: AdminAuditListRow): string {
  return [
    row.createdAt.toISOString(),
    row.actorName?.trim() || '',
    row.actorEmail?.trim() || '',
    row.actorUserId,
    row.action,
    row.targetType,
    row.targetId,
  ]
    .map(cell)
    .join(',')
}

export async function GET(request: Request) {
  const reader = await requireAuditLogReader()
  if (!reader?.company) {
    return NextResponse.json({ error: 'Audit log is not available.' }, { status: 403 })
  }

  const url = new URL(request.url)
  const search = Object.fromEntries(url.searchParams.entries())
  try {
    const rows = await listAdminAudit({ ...auditQueryFromSearch(search), limit: 2000 })
    const body = [
      'when,actor_name,actor_email,actor_id,action,target_type,target_id',
      ...rows.map(csvRow),
    ].join('\n')
    return new NextResponse(body, {
      status: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': 'attachment; filename="starforge-audit.csv"',
      },
    })
  } catch (error) {
    const message =
      error instanceof AdminAuditUnavailableError
        ? error.message
        : 'Could not export the audit trail.'
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
