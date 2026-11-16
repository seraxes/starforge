import React from 'react'
import Link from 'next/link'

import {
  ADMIN_AUDIT_LIST_LIMIT,
  AdminAuditUnavailableError,
  listAdminAudit,
  requireAuditLogReader,
  type AdminAuditListRow,
} from '@/core/audit'

import { auditFilterQuery, auditQueryFromSearch } from '../query'

type Search = Record<string, string | string[] | undefined>

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

export async function AuditLogPanel({ searchParams }: { searchParams: Search }) {
  const reader = await requireAuditLogReader()
  if (!reader?.company) {
    return (
      <section className="admin-section admin-layouts-full">
        <h2>Audit</h2>
        <p className="admin-inline-error" role="alert">
          Turn on Audit log under Settings → Modules, then grant view on admin.audit.
        </p>
      </section>
    )
  }

  const query = auditQueryFromSearch(searchParams)
  let rows: AdminAuditListRow[] = []
  let loadError: string | null = null
  try {
    rows = await listAdminAudit({ ...query, limit: ADMIN_AUDIT_LIST_LIMIT })
  } catch (error) {
    loadError =
      error instanceof AdminAuditUnavailableError
        ? error.message
        : 'Could not load the audit trail.'
  }

  const filters = auditFilterQuery(searchParams)

  return (
    <section className="admin-section admin-layouts-full">
      <h2>Audit</h2>
      <p className="lede admin-lede">
        Who did what, and when. Append-only. Newest first. Showing the latest{' '}
        {ADMIN_AUDIT_LIST_LIMIT}. Host security rows are always recorded. Day-to-day
        content and commerce rows are recorded while this module is on.
      </p>

      <form method="get" className="admin-inline-actions" action="/admin/audit">
        <label className="settings-field">
          <span>From</span>
          <input type="date" name="from" defaultValue={query.from || ''} />
        </label>
        <label className="settings-field">
          <span>To</span>
          <input type="date" name="to" defaultValue={query.to || ''} />
        </label>
        <label className="settings-field">
          <span>Actor</span>
          <input type="search" name="actor" defaultValue={query.actor || ''} placeholder="Name or email" />
        </label>
        <label className="settings-field">
          <span>Action</span>
          <input type="text" name="action" defaultValue={query.action || ''} placeholder="event." />
        </label>
        <label className="settings-field">
          <span>Target</span>
          <input type="text" name="targetType" defaultValue={query.targetType || ''} placeholder="event" />
        </label>
        <div className="page-settings-actions">
          <button type="submit" className="gantry-toolbar-btn">
            Filter
          </button>
          <Link className="gantry-toolbar-btn" href={`/api/admin/audit/export${filters}`}>
            Export CSV
          </Link>
        </div>
      </form>

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
                  <p className="admin-empty">No matching admin changes.</p>
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

export default AuditLogPanel
