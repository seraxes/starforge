'use client'

import React, { useActionState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '../admin-toast'

type StatusState = { ok?: boolean; error?: string }

const initial: StatusState = {}

export function UserProfileStatusForm({
  userId,
  status,
  handle,
  action: statusAction,
}: {
  userId: string
  status: string
  handle: string
  action: (prev: StatusState, formData: FormData) => Promise<StatusState>
}) {
  const router = useRouter()
  const [state, action, pending] = useActionState(statusAction, initial)
  useNotifySavedOnOk(state)

  useEffect(() => {
    if (state.ok) router.refresh()
  }, [state, router])

  return (
    <div className="admin-action-row">
      <form action={action}>
        <input type="hidden" name="userId" value={userId} />
        <input
          type="hidden"
          name="status"
          value={status === 'hidden' ? 'active' : 'hidden'}
        />
        <button type="submit" className="gantry-toolbar-btn gantry-toolbar-btn-muted" disabled={pending}>
          {pending
            ? 'Updating…'
            : status === 'hidden'
              ? 'Unhide public profile'
              : 'Hide public profile'}
        </button>
      </form>
      {handle ? (
        <Link href={`/u/${handle}`} className="gantry-toolbar-btn gantry-toolbar-btn-muted">
          View /u/{handle}
        </Link>
      ) : null}
      {state.error ? (
        <span className="admin-inline-error" role="alert">
          {state.error}
        </span>
      ) : null}
    </div>
  )
}
