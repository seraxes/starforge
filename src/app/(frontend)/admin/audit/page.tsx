import React from 'react'
import { redirect } from 'next/navigation'

import {
  ADMIN_AUDIT_LIST_LIMIT,
  AdminAuditUnavailableError,
  listAdminAudit,
  type AdminAuditListRow,
} from '@/core/audit'
import { requireDeveloperAdmin } from '@/core/auth/admin'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Audit — Starforge',
  description: 'Read-only admin audit trail for developer-admins.',
}

function formatWhen(date: Date): string {
  try {
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return date.toISOString()
  }
}

function actorLabel(row: AdminAuditListRow): string {
  const name = row.actorName?.trim() ?? ''
  const email = row.actorEmail?.trim() ?? ''
  if (name && email) return `${name} · ${email}`
  if (name || email) return name || email
  return row.actorUserId
}

export default async function AdminAuditPage() {
  const session = await requireDeveloperAdmin()
  if (!session?.user) {
    redirect('/admin')
  }

  let rows: AdminAuditListRow[] = []
  let loadError: string | null = null
  try {
    rows = await listAdminAudit()
  } catch (error) {
    loadError =
      error instanceof AdminAuditUnavailableError
        ? error.message
        : 'Could not load the audit trail.'
  }

  return (
    <section className="admin-section admin-layouts-full">
      <h2>Audit</h2>
      <p className="lede admin-lede">
        Append-only record of account changes, module on/off, redirects, and environment
        saves. {`Newest first. Showing the latest ${ADMIN_AUDIT_LIST_LIMIT}. Read only.`}
      </p>

      {loadError ? (
        <p className="admin-inline-error" role="alert">
          {loadError}
        </p>
      ) : null}

      <div className="outlines-table-wrap admin-settings-panel-wide">
        <table className="outlines-table">
          <thead>
            <tr>
              <th scope="col">When</th>
              <th scope="col">Actor</th>
              <th scope="col">Action</th>
              <th scope="col">Target</th>
              <th scope="col">Id</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <p className="admin-empty">No admin changes recorded yet.</p>
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>{formatWhen(row.createdAt)}</td>
                  <td title={row.actorUserId}>{actorLabel(row)}</td>
                  <td>
                    <code>{row.action}</code>
                  </td>
                  <td>{row.targetType}</td>
                  <td>
                    <code>{row.targetId}</code>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
