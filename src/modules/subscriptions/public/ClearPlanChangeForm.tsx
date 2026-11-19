'use client'

import React, { useActionState } from 'react'

import { clearScheduledPlanAction, type SubscriptionsActionState } from '../actions'

const initial: SubscriptionsActionState = {}

export function ClearPlanChangeForm({ periodId }: { periodId: string }) {
  const [state, action, pending] = useActionState(clearScheduledPlanAction, initial)
  return (
    <form action={action}>
      <input type="hidden" name="periodId" value={periodId} />
      {state.error ? (
        <p className="admin-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok && state.message ? (
        <p className="admin-inline-ok" role="status">
          {state.message}
        </p>
      ) : null}
      <button type="submit" className="gantry-btn" disabled={pending}>
        {pending ? 'Working…' : 'Keep this plan'}
      </button>
    </form>
  )
}
