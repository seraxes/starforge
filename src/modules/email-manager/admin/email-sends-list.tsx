import React from 'react'
import Link from 'next/link'

import type { EmailSendListRow } from '../list-sends'

type Props = {
  rows: EmailSendListRow[]
  unavailable: boolean
}

function formatWhen(date: Date): string {
  try {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '—'
    return date.toLocaleString()
  } catch {
    return '—'
  }
}

function statusLabel(status: EmailSendListRow['status']): string {
  if (status === 'sent') return 'Sent'
  if (status === 'skipped') return 'Skipped'
  return 'Failed'
}

/**
 * Read-only recent send log — Page Settings / outlines table chrome.
 */
export function EmailSendsList({ rows, unavailable }: Props) {
  return (
    <div className="sf-email-sends-list admin-settings-mosaic">
      <section className="outlines-create" aria-label="About send log">
        <h3>Recent sends</h3>
        <p className="field-hint">
          Outbound Mailer attempts (success, failure, skipped) recorded in{' '}
          <code>sf_email_sends</code>. Dashboard counts use the same log. Rules:{' '}
          <Link href="/admin/email">Email → Rules</Link>. Templates:{' '}
          <Link href="/admin/email/templates">Email → Templates</Link>.
        </p>
      </section>

      <div className="outlines-table-wrap admin-settings-panel-wide" aria-label="Send log">
        <table className="outlines-table">
          <thead>
            <tr>
              <th scope="col">When</th>
              <th scope="col">To</th>
              <th scope="col">Type</th>
              <th scope="col">Status</th>
              <th scope="col">Title</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="admin-empty">
                  {unavailable
                    ? 'Send log is unavailable right now (run db:migrate if the table is missing). Sends will show here once the log is reachable.'
                    : 'No sends logged yet. Outbound Mailer traffic will appear here.'}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} title={row.error || undefined}>
                  <td>{formatWhen(row.createdAt)}</td>
                  <td>
                    <code>{row.toAddress}</code>
                  </td>
                  <td>{row.emailType}</td>
                  <td>
                    {statusLabel(row.status)}
                    {row.status === 'failed' && row.error ? (
                      <span className="field-hint"> — {row.error.slice(0, 80)}</span>
                    ) : null}
                  </td>
                  <td>
                    <strong>{row.title}</strong>
                    {row.subject && row.title !== row.subject ? (
                      <span className="field-hint"> ({row.subject})</span>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
