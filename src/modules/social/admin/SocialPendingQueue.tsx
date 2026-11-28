'use client'

import React, { useActionState } from 'react'

import {
  approvePendingSocialPostAction,
  rejectPendingSocialPostAction,
  type SocialModerationActionState,
} from '../actions'

export type SocialPendingQueueRow = {
  id: string
  authorUserId: string
  bodyPreview: string
  audience: string
  createdAt: string
}

const initial: SocialModerationActionState = {}

function PendingRowActions({ postId }: { postId: string }) {
  const [approveState, approveAction, approvePending] = useActionState(
    approvePendingSocialPostAction,
    initial,
  )
  const [rejectState, rejectAction, rejectPending] = useActionState(
    rejectPendingSocialPostAction,
    initial,
  )

  return (
    <div className="page-settings-actions">
      {approveState.error ? <p className="admin-inline-error">{approveState.error}</p> : null}
      {approveState.ok ? <p className="admin-inline-ok">Approved.</p> : null}
      {rejectState.error ? <p className="admin-inline-error">{rejectState.error}</p> : null}
      {rejectState.ok ? <p className="admin-inline-ok">Rejected.</p> : null}
      <div className="admin-control-row">
        <form action={approveAction}>
          <input type="hidden" name="postId" value={postId} />
          <button type="submit" className="gantry-toolbar-btn-save" disabled={approvePending}>
            Approve
          </button>
        </form>
        <form action={rejectAction}>
          <input type="hidden" name="postId" value={postId} />
          <button type="submit" className="gantry-toolbar-btn" disabled={rejectPending}>
            Reject
          </button>
        </form>
      </div>
    </div>
  )
}

/** Pending-review list for /admin/social/pending. */
export function SocialPendingQueue({ rows }: { rows: SocialPendingQueueRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="admin-settings-mosaic">
        <div className="page-settings-panel">
          <div className="page-settings-panel-head">
            <h3>Pending review</h3>
          </div>
          <div className="page-settings-panel-body">
            <p className="layout-muted settings-hint">No posts waiting for review.</p>
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
              {row.audience} · <code>{row.id}</code>
            </h3>
          </div>
          <div className="page-settings-panel-body">
            <p>
              Author <code>{row.authorUserId}</code>
              {' · '}
              <time dateTime={row.createdAt}>{row.createdAt.slice(0, 16).replace('T', ' ')}</time>
            </p>
            {row.bodyPreview ? <p>{row.bodyPreview}</p> : <p className="layout-muted">(no text)</p>}
            <PendingRowActions postId={row.id} />
          </div>
        </div>
      ))}
    </div>
  )
}
