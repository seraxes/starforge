'use client'

import { useRouter } from 'next/navigation'
import React, { useActionState, useEffect } from 'react'

import {
  unlockEventPasswordAction,
  type EventUnlockActionState,
} from '../actions'

const initial: EventUnlockActionState = {}

type Props = {
  eventId: string
  title: string
}

/**
 * Shared-password unlock form for password-gated public events.
 */
export function EventPasswordGate({ eventId, title }: Props) {
  const router = useRouter()
  const [state, action, pending] = useActionState(unlockEventPasswordAction, initial)

  useEffect(() => {
    if (state.ok) router.refresh()
  }, [state.ok, router])

  return (
    <section className="outlines-create sf-events-password-gate" aria-label="Event password">
      <h2>{title}</h2>
      <p className="settings-hint">This event is password protected. Enter the shared password to continue.</p>
      <form action={action} className="outlines-create-form admin-create-form">
        <input type="hidden" name="eventId" value={eventId} />
        <label className="settings-field">
          <span>Password</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            disabled={pending}
          />
        </label>
        {state.error ? (
          <p className="form-error" role="alert">
            {state.error}
          </p>
        ) : null}
        <div className="page-settings-actions">
          <button
            type="submit"
            className="gantry-btn gantry-btn-primary"
            disabled={pending}
          >
            {pending ? 'Checking…' : 'Unlock'}
          </button>
        </div>
      </form>
    </section>
  )
}
