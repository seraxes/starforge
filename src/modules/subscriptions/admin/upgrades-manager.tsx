'use client'

import React, { useActionState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'

import {
  addUpgradePathAction,
  removeUpgradePathAction,
  setUpgradePathCreditModeAction,
  type SubscriptionsActionState,
} from '../actions'
import type { ChangeCreditMode } from '../lifecycle-math'

const initial: SubscriptionsActionState = {}

export type UpgradePathView = {
  id: string
  fromPlanId: string
  toPlanId: string
  creditMode: ChangeCreditMode
}

export type UpgradePlanOption = {
  id: string
  title: string
}

function planTitle(plans: UpgradePlanOption[], id: string): string {
  return plans.find((plan) => plan.id === id)?.title || id
}

function AddPathForm({ plans }: { plans: UpgradePlanOption[] }) {
  const router = useRouter()
  const [state, action, pending] = useActionState(addUpgradePathAction, initial)
  useNotifySavedOnOk(state)
  useEffect(() => {
    if (state.ok) router.refresh()
  }, [state.ok, router])

  return (
    <form action={action} className="sf-events-form-mosaic">
      <fieldset className="settings-fieldset sf-events-form-section">
        <legend>Add path</legend>
        <div className="sf-subscriptions-plan-fields">
          <label className="settings-field">
            <span>From</span>
            <select name="fromPlanId" required disabled={pending} defaultValue="">
              <option value="" disabled>
                Current plan
              </option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.title}
                </option>
              ))}
            </select>
          </label>
          <label className="settings-field">
            <span>To</span>
            <select name="toPlanId" required disabled={pending} defaultValue="">
              <option value="" disabled>
                Other plan
              </option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.title}
                </option>
              ))}
            </select>
          </label>
          <label className="settings-field">
            <span>Upgrade charge</span>
            <select name="creditMode" defaultValue="prorate" disabled={pending}>
              <option value="prorate">Credit leftover days</option>
              <option value="full">Charge full price</option>
            </select>
            <span className="settings-hint">
              Only when To costs more. Credit leftover days subtracts unused time. Charge full
              price ignores it. A cheaper To waits until this term ends — no refund.
            </span>
          </label>
        </div>
        <p className="settings-hint">
          A member on From may move to To. A higher price starts now. A lower price starts on the
          next renewal.
        </p>
        {state.error ? (
          <p className="admin-inline-error" role="alert">
            {state.error}
          </p>
        ) : null}
        <div className="page-settings-actions">
          <button type="submit" className="gantry-toolbar-btn gantry-toolbar-btn-save" disabled={pending}>
            {pending ? 'Saving…' : 'Add'}
          </button>
        </div>
      </fieldset>
    </form>
  )
}

function PathRowActions({
  id,
  creditMode,
}: {
  id: string
  creditMode: ChangeCreditMode
}) {
  const router = useRouter()
  const [creditState, creditAction, creditPending] = useActionState(
    setUpgradePathCreditModeAction,
    initial,
  )
  const [removeState, removeAction, removePending] = useActionState(
    removeUpgradePathAction,
    initial,
  )
  useNotifySavedOnOk(creditState)
  useNotifySavedOnOk(removeState)
  useEffect(() => {
    if (creditState.ok || removeState.ok) router.refresh()
  }, [creditState.ok, removeState.ok, router])

  const pending = creditPending || removePending
  const error = creditState.error || removeState.error

  return (
    <div className="sf-subscriptions-path-actions">
      <form action={creditAction} className="sf-subscriptions-path-credit">
        <input type="hidden" name="id" value={id} />
        <select
          name="creditMode"
          defaultValue={creditMode}
          disabled={pending}
          aria-label="Upgrade charge"
          title="Only when the new plan costs more"
        >
          <option value="prorate">Credit leftover</option>
          <option value="full">Full price</option>
        </select>
        <button type="submit" className="gantry-toolbar-btn gantry-toolbar-btn-save" disabled={pending}>
          {creditPending ? 'Saving…' : 'Save'}
        </button>
      </form>
      <form action={removeAction}>
        <input type="hidden" name="id" value={id} />
        <button
          type="submit"
          className="gantry-toolbar-btn gantry-toolbar-btn-muted"
          disabled={pending}
        >
          {removePending ? 'Removing…' : 'Remove'}
        </button>
      </form>
      {error ? (
        <p className="admin-inline-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function UpgradesManager({
  plans,
  paths,
}: {
  plans: UpgradePlanOption[]
  paths: UpgradePathView[]
}) {
  const rows = useMemo(
    () =>
      [...paths].sort((a, b) => {
        const from = planTitle(plans, a.fromPlanId).localeCompare(planTitle(plans, b.fromPlanId))
        if (from !== 0) return from
        return planTitle(plans, a.toPlanId).localeCompare(planTitle(plans, b.toPlanId))
      }),
    [paths, plans],
  )

  return (
    <>
      {plans.length < 2 ? (
        <p className="lede">Add at least two plans before setting an upgrade path.</p>
      ) : (
        <AddPathForm plans={plans} />
      )}

      <section className="outlines-create" aria-label="Plan change paths" style={{ marginTop: '1.5rem' }}>
        <h3>Paths</h3>
        {rows.length === 0 ? (
          <p className="admin-empty">
            No plan changes yet. A member can move only along a path you add here.
          </p>
        ) : (
          <div className="outlines-table-wrap">
            <table className="outlines-table">
              <thead>
                <tr>
                  <th scope="col">From</th>
                  <th scope="col">To</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((path) => (
                  <tr key={path.id}>
                    <td>{planTitle(plans, path.fromPlanId)}</td>
                    <td>{planTitle(plans, path.toPlanId)}</td>
                    <td className="outlines-actions">
                      <PathRowActions id={path.id} creditMode={path.creditMode} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
