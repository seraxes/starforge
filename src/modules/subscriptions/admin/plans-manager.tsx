'use client'

import React, { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'

import {
  createPlanAction,
  setPlanActiveAction,
  updatePlanAction,
  type SubscriptionsActionState,
} from '../actions'
import {
  PLAN_SUBJECTS,
  defaultEntitlementKeysForSubject,
  type SubscriptionPlanRecord,
} from '../types'

const initial: SubscriptionsActionState = {}

const SUBJECTS: { value: string; label: string }[] = [
  { value: PLAN_SUBJECTS.membership, label: 'Player premium' },
  { value: PLAN_SUBJECTS.organizer, label: 'Organizer premium' },
  { value: PLAN_SUBJECTS.advertisement, label: 'Advertisement' },
]

const AUDIENCES: { value: string; label: string }[] = [
  { value: '', label: '—' },
  { value: 'shop', label: 'Shop' },
  { value: 'organizer', label: 'Organizer promo' },
  { value: 'marketplace', label: 'Marketplace' },
]

type Props = {
  plans: SubscriptionPlanRecord[]
  currency: string
  subjectFilter: string
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

function PlanFields({
  row,
  pending,
}: {
  row?: SubscriptionPlanRecord
  pending: boolean
}) {
  const [subject, setSubject] = useState(row?.subject || PLAN_SUBJECTS.membership)
  const defaultKeys =
    row?.entitlementKeys?.join(', ') ||
    defaultEntitlementKeysForSubject(subject).join(', ')

  return (
    <>
      <label className="settings-field">
        <span>Subject</span>
        <select
          name="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          disabled={pending}
        >
          {SUBJECTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      {subject === PLAN_SUBJECTS.advertisement ? (
        <label className="settings-field">
          <span>Audience</span>
          <select name="audience" defaultValue={row?.audience || ''} disabled={pending}>
            {AUDIENCES.map((a) => (
              <option key={a.value || 'none'} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <input type="hidden" name="audience" value="" />
      )}
      <label className="settings-field">
        <span>Title</span>
        <input
          type="text"
          name="title"
          required
          defaultValue={row?.title ?? ''}
          disabled={pending}
          autoComplete="off"
        />
      </label>
      <label className="settings-field">
        <span>Description</span>
        <textarea
          name="description"
          rows={2}
          defaultValue={row?.description ?? ''}
          disabled={pending}
        />
      </label>
      <label className="settings-field">
        <span>Price (major)</span>
        <input
          type="number"
          name="price"
          min={0}
          step={1}
          required
          defaultValue={row?.price ?? 0}
          disabled={pending}
        />
      </label>
      <label className="settings-field">
        <span>Billing period</span>
        <select name="billingPeriod" defaultValue={row?.billingPeriod || 'month'} disabled={pending}>
          <option value="month">Month</option>
          <option value="year">Year</option>
        </select>
      </label>
      <label className="settings-field">
        <span>Entitlement keys</span>
        <input
          type="text"
          name="entitlementKeys"
          defaultValue={defaultKeys}
          disabled={pending}
          title="Comma-separated. Empty uses subject defaults."
          placeholder="events.member"
        />
        <span className="settings-hint">Comma-separated. Empty uses subject defaults.</span>
      </label>
      <label className="settings-field">
        <span>Group ids</span>
        <input
          type="text"
          name="groupIds"
          defaultValue={row?.groupIds?.join(', ') ?? ''}
          disabled={pending}
          title="Optional Core group ids for audience resolve (not written to membership)."
          placeholder="Optional"
        />
      </label>
      <label className="settings-field">
        <span>Sort</span>
        <input
          type="number"
          name="sortOrder"
          defaultValue={row?.sortOrder ?? 0}
          disabled={pending}
        />
      </label>
      <label className="settings-field settings-flag">
        <span>Active</span>
        <input
          type="checkbox"
          name="active"
          value="1"
          defaultChecked={row ? row.active : true}
          disabled={pending}
        />
      </label>
    </>
  )
}

function CreatePlanCard({ currency }: { currency: string }) {
  const router = useRouter()
  const [state, action, pending] = useActionState(createPlanAction, initial)
  useNotifySavedOnOk(state)
  useEffect(() => {
    if (state.ok) router.refresh()
  }, [state.ok, router])

  return (
    <article className="page-settings-panel outlines-create">
      <div className="page-settings-panel-head">
        <h3>Add plan</h3>
        <p className="settings-hint">Currency: {currency}. Checkout re-reads price server-side.</p>
      </div>
      <div className="page-settings-panel-body">
        <form action={action} className="admin-settings-mosaic">
          <PlanFields pending={pending} />
          <Feedback state={state} />
          <div className="page-settings-actions">
            <button type="submit" className="gantry-toolbar-btn gantry-toolbar-btn-save" disabled={pending}>
              Create
            </button>
          </div>
        </form>
      </div>
    </article>
  )
}

function EditPlanCard({ plan }: { plan: SubscriptionPlanRecord }) {
  const router = useRouter()
  const [state, action, pending] = useActionState(updatePlanAction, initial)
  const [activeState, activeAction, activePending] = useActionState(setPlanActiveAction, initial)
  useNotifySavedOnOk(state)
  useNotifySavedOnOk(activeState)
  useEffect(() => {
    if (state.ok || activeState.ok) router.refresh()
  }, [state.ok, activeState.ok, router])

  return (
    <article className="page-settings-panel">
      <div className="page-settings-panel-head">
        <h3>{plan.title}</h3>
        <p className="settings-hint">
          {plan.subject}
          {plan.audience ? ` · ${plan.audience}` : ''} · {plan.billingPeriod} ·{' '}
          {plan.active ? 'active' : 'inactive'}
        </p>
      </div>
      <div className="page-settings-panel-body">
        <form action={action} className="admin-settings-mosaic">
          <input type="hidden" name="id" value={plan.id} />
          <PlanFields row={plan} pending={pending} />
          <Feedback state={state} />
          <div className="page-settings-actions">
            <button type="submit" className="gantry-toolbar-btn gantry-toolbar-btn-save" disabled={pending}>
              Save
            </button>
          </div>
        </form>
        <form action={activeAction} className="admin-inline-actions">
          <input type="hidden" name="id" value={plan.id} />
          <input type="hidden" name="active" value={plan.active ? '0' : '1'} />
          <button
            type="submit"
            className="gantry-toolbar-btn"
            disabled={activePending}
            title={plan.active ? 'Deactivate' : 'Activate'}
          >
            {plan.active ? 'Deactivate' : 'Activate'}
          </button>
          <Feedback state={activeState} />
        </form>
      </div>
    </article>
  )
}

export function PlansManager({ plans, currency, subjectFilter }: Props) {
  const filtered = subjectFilter
    ? plans.filter((p) => p.subject === subjectFilter)
    : plans

  return (
    <div className="sf-subscriptions-manager admin-settings-mosaic">
      <CreatePlanCard currency={currency} />
      {filtered.map((plan) => (
        <EditPlanCard key={plan.id} plan={plan} />
      ))}
      {filtered.length === 0 ? (
        <p className="admin-lede">No plans yet{subjectFilter ? ` for ${subjectFilter}` : ''}.</p>
      ) : null}
    </div>
  )
}
