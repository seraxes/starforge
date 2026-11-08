'use client'

import React, { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'

import { markOrderPaidAction, type PaymentsActionState } from '../actions'

const initial: PaymentsActionState = {}

export function MarkPaidForm({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [state, action, pending] = useActionState(markOrderPaidAction, initial)

  useNotifySavedOnOk(state)
  useEffect(() => {
    if (state.ok) router.refresh()
  }, [state, router])

  return (
    <form action={action} className="page-settings-panel-body">
      <input type="hidden" name="orderId" value={orderId} />
      <label className="settings-field">
        <span>Audit reason (required)</span>
        <input
          name="reason"
          required
          placeholder="e.g. Bank transfer received / cash at door"
          disabled={pending}
        />
      </label>
      {state.error ? (
        <p className="admin-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="page-settings-actions">
        <button
          type="submit"
          className="gantry-toolbar-btn gantry-toolbar-btn-save"
          disabled={pending}
        >
          {pending ? 'Saving…' : 'Mark paid'}
        </button>
      </div>
    </form>
  )
}
