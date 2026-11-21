'use client'

import React, { useActionState } from 'react'

import {
  banSocialMemberAction,
  resolveSocialReportAction,
  type SocialModerationActionState,
} from '../actions'

export type SocialReportQueueRow = {
  id: string
  postId: string
  commentId: string | null
  reporterUserId: string
  reason: string
  note: string | null
  createdAt: string
  postDeleted: boolean
  postBodyPreview: string | null
  authorUserId: string | null
}

const initial: SocialModerationActionState = {}

function ReportRowActions({ reportId, authorUserId }: { reportId: string; authorUserId: string | null }) {
  const [state, formAction, pending] = useActionState(resolveSocialReportAction, initial)
  const [banState, banAction, banPending] = useActionState(banSocialMemberAction, initial)

  return (
    <div className="page-settings-actions">
      {state.error ? <p className="admin-inline-error">{state.error}</p> : null}
      {state.ok ? <p className="admin-inline-ok">Resolved.</p> : null}
      {banState.error ? <p className="admin-inline-error">{banState.error}</p> : null}
      {banState.ok ? <p className="admin-inline-ok">Member banned.</p> : null}
      <div className="admin-control-row">
        <form action={formAction}>
          <input type="hidden" name="reportId" value={reportId} />
          <input type="hidden" name="status" value="dismissed" />
          <button type="submit" className="gantry-toolbar-btn" disabled={pending}>
            Dismiss
          </button>
        </form>
        <form action={formAction}>
          <input type="hidden" name="reportId" value={reportId} />
          <input type="hidden" name="status" value="hidden" />
          <button type="submit" className="gantry-toolbar-btn" disabled={pending}>
            Hide
          </button>
        </form>
        {authorUserId ? (
          <form action={banAction}>
            <input type="hidden" name="userId" value={authorUserId} />
            <button type="submit" className="gantry-toolbar-btn" disabled={banPending}>
              Ban author
            </button>
          </form>
        ) : null}
      </div>
    </div>
  )
}

/** Open-report list for /admin/social/reports. */
export function SocialReportsQueue({ rows }: { rows: SocialReportQueueRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="admin-settings-mosaic">
        <div className="page-settings-panel">
          <div className="page-settings-panel-head">
            <h3>Open reports</h3>
          </div>
          <div className="page-settings-panel-body">
            <p className="layout-muted settings-hint">No open reports.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-settings-mosaic">
      {rows.map((row) => (
        <div key={row.id} className="page-settings-panel">
          <div className="page-settings-panel-head">
            <h3>
              {row.reason}
              {row.commentId ? ' · comment' : ' · post'}
            </h3>
          </div>
          <div className="page-settings-panel-body">
            <p>
              Post <code>{row.postId}</code>
              {row.postDeleted ? ' (deleted)' : null}
              {row.commentId ? (
                <>
                  {' '}
                  · comment <code>{row.commentId}</code>
                </>
              ) : null}
            </p>
            {row.postBodyPreview ? <p>{row.postBodyPreview}</p> : null}
            <p className="layout-muted settings-hint">
              Reporter <code>{row.reporterUserId}</code>
              {row.authorUserId ? (
                <>
                  {' '}
                  · author <code>{row.authorUserId}</code>
                </>
              ) : null}
              {' · '}
              {new Date(row.createdAt).toLocaleString()}
              {row.note ? ` · ${row.note}` : null}
            </p>
            <ReportRowActions reportId={row.id} authorUserId={row.authorUserId} />
          </div>
        </div>
      ))}
    </div>
  )
}
