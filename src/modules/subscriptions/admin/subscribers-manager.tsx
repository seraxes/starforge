'use client'

import React, { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'

import { adminCompPeriodAction, type SubscriptionsActionState } from '../actions'
import type { SubscriptionPeriodRecord, SubscriptionPlanRecord } from '../types'

const initial: SubscriptionsActionState = {}

type Props = {
  periods: SubscriptionPeriodRecord[]
  plans: SubscriptionPlanRecord[]
}

function Feedback({ state }: { state: SubscriptionsActionState }) {
  if (state.error) {
    return (
      <p className="admin-inline-error" role="alert">
        {state.error}
      </p>
    )
  }
  if (state.ok) {
    return (
      <p className="admin-inline-ok" role="status">
        Saved.
      </p>
    )
  }
  return null
}

export function SubscribersManager({ periods, plans }: Props) {
  const router = useRouter()
  const [state, action, pending] = useActionState(adminCompPeriodAction, initial)
  useNotifySavedOnOk(state)
  useEffect(() => {
    if (state.ok) router.refresh()
  }, [state.ok, router])

  const planTitle = (id: string) => plans.find((p) => p.id === id)?.title || id

  return (
    <div className="sf-subscriptions-manager">
      <article className="page-settings-panel outlines-create">
        <div className="page-settings-panel-head">
          <h3>Comp a period</h3>
          <p className="settings-hint">Admin grant without checkout. Extends an active period for the same plan.</p>
        </div>
        <div className="page-settings-panel-body">
          <form action={action} className="admin-settings-mosaic">
            <label className="settings-field">
              <span>Plan</span>
              <select name="planId" required disabled={pending || plans.length === 0}>
                <option value="">Select plan</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({p.subject})
                  </option>
                ))}
              </select>
            </label>
            <label className="settings-field">
              <span>User id</span>
              <input
                type="text"
                name="userId"
                required
                disabled={pending}
                autoComplete="off"
                placeholder="Better Auth user id"
              />
            </label>
            <Feedback state={state} />
            <div className="page-settings-actions">
              <button
                type="submit"
                className="gantry-toolbar-btn gantry-toolbar-btn-save"
                disabled={pending || plans.length === 0}
              >
                Comp
              </button>
            </div>
          </form>
        </div>
      </article>

      <div className="page-settings-panel">
        <div className="page-settings-panel-head">
          <h3>Periods</h3>
        </div>
        <div className="page-settings-panel-body">
          {periods.length === 0 ? (
            <p className="admin-lede">No subscription periods yet.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Starts</th>
                  <th>Ends</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {periods.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <code title={p.userId}>{p.userId.slice(0, 12)}…</code>
                    </td>
                    <td>{planTitle(p.planId)}</td>
                    <td>{p.status}</td>
                    <td>{p.startsAt.toISOString().slice(0, 10)}</td>
                    <td>{p.endsAt.toISOString().slice(0, 10)}</td>
                    <td>{p.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
