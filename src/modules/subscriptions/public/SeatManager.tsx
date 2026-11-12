'use client'

import React, { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import {
  addSeatAction,
  removeSeatAction,
  type SubscriptionsActionState,
} from '../actions'
import type { SubscriptionSeatRecord } from '../types'

const initial: SubscriptionsActionState = {}

export function SeatManager({
  periodId,
  seats,
  seatLimit,
}: {
  periodId: string
  seats: SubscriptionSeatRecord[]
  seatLimit: number
}) {
  const router = useRouter()
  const [addState, addAction, addPending] = useActionState(addSeatAction, initial)
  const [removeState, removeAction, removePending] = useActionState(removeSeatAction, initial)

  useEffect(() => {
    if (addState.ok || removeState.ok) router.refresh()
  }, [addState.ok, removeState.ok, router])

  return (
    <div className="settings-fieldset">
      <p className="settings-hint">
        Seats {seats.length}/{seatLimit}. Group admin renews for everyone.
      </p>
      <ul>
        {seats.map((seat) => (
          <li key={seat.id}>
            {seat.userId} ({seat.role})
            {seat.role !== 'admin' ? (
              <form action={removeAction} style={{ display: 'inline', marginLeft: '0.5rem' }}>
                <input type="hidden" name="periodId" value={periodId} />
                <input type="hidden" name="memberUserId" value={seat.userId} />
                <button
                  type="submit"
                  className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                  disabled={removePending}
                >
                  Remove
                </button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
      {seats.length < seatLimit ? (
        <form action={addAction}>
          <input type="hidden" name="periodId" value={periodId} />
          <label className="settings-field">
            <span>Member user id</span>
            <input type="text" name="memberUserId" required disabled={addPending} autoComplete="off" />
          </label>
          {addState.error ? (
            <p className="admin-inline-error" role="alert">
              {addState.error}
            </p>
          ) : null}
          <div className="page-settings-actions">
            <button type="submit" className="gantry-toolbar-btn" disabled={addPending}>
              {addPending ? 'Adding…' : 'Add seat'}
            </button>
          </div>
        </form>
      ) : null}
      {removeState.error ? (
        <p className="admin-inline-error" role="alert">
          {removeState.error}
        </p>
      ) : null}
    </div>
  )
}
