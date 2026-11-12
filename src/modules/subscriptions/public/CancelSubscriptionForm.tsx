'use client'

import React, { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { cancelSubscriptionAction, type SubscriptionsActionState } from '../actions'

const initial: SubscriptionsActionState = {}

export function CancelSubscriptionForm({
  periodId,
  cancelAtPeriodEnd,
}: {
  periodId: string
  cancelAtPeriodEnd: boolean
}) {
  const router = useRouter()
  const [state, action, pending] = useActionState(cancelSubscriptionAction, initial)

  useEffect(() => {
    if (state.ok) router.refresh()
  }, [state.ok, router])

  return (
    <form action={action} className="admin-inline-actions">
      <input type="hidden" name="periodId" value={periodId} />
      <input type="hidden" name="cancel" value={cancelAtPeriodEnd ? '0' : '1'} />
      {state.error ? (
        <p className="admin-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className="gantry-toolbar-btn gantry-toolbar-btn-muted" disabled={pending}>
        {pending
          ? 'Saving…'
          : cancelAtPeriodEnd
            ? 'Resume at period end'
            : 'Cancel at period end'}
      </button>
    </form>
  )
}
