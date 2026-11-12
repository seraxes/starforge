'use client'

import React, { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'

import {
  createCouponAction,
  deleteCouponAction,
  setCouponActiveAction,
  updateCouponAction,
  type PaymentsActionState,
} from '../actions'
import { formatCouponDiscountInput, type CouponRecord } from '../coupon-rules'

const initial: PaymentsActionState = {}

const SOURCE_MODULES: { value: string; label: string }[] = [
  { value: '', label: 'Site-wide (all modules)' },
  { value: 'product:events', label: 'Events' },
  { value: 'product:shop', label: 'Shop' },
  { value: 'product:subscriptions', label: 'Subscriptions' },
  { value: 'product:marketplace', label: 'Marketplace' },
  { value: 'product:ads', label: 'Ads' },
]

type Props = {
  coupons: CouponRecord[]
  defaultCurrency: string
}

function Feedback({ state }: { state: PaymentsActionState }) {
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

function CouponFields({
  row,
  defaultCurrency,
  pending,
}: {
  row?: CouponRecord
  defaultCurrency: string
  pending: boolean
}) {
  const [sourceModule, setSourceModule] = useState(row?.sourceModule || '')

  return (
    <>
      <label className="settings-field">
        <span>Code</span>
        <input
          type="text"
          name="code"
          required
          defaultValue={row?.code ?? ''}
          disabled={pending}
          autoComplete="off"
          placeholder="SUMMER10"
          title="Stored uppercase; buyers enter this at checkout"
        />
      </label>
      <label className="settings-field">
        <span>Discount</span>
        <input
          type="text"
          name="discount"
          required
          defaultValue={
            row
              ? formatCouponDiscountInput({
                  mode: row.discountMode,
                  value: row.discountValue,
                })
              : ''
          }
          disabled={pending}
          autoComplete="off"
          placeholder="500 or 10%"
          title="Number = amount off; add % for percent off (e.g. 500 or 10%)"
        />
      </label>
      <label className="settings-field">
        <span>Currency</span>
        <input
          type="text"
          name="currency"
          defaultValue={row?.currency || defaultCurrency}
          disabled={pending}
          autoComplete="off"
          title="Required for amount coupons; must match cart currency"
        />
      </label>
      <label className="settings-field">
        <span>Usage limit</span>
        <input
          type="number"
          name="usageLimit"
          min={1}
          step={1}
          defaultValue={row?.usageLimit ?? ''}
          disabled={pending}
          placeholder="Unlimited"
          title="Leave empty for unlimited redemptions"
        />
      </label>
      <label className="settings-field">
        <span>Scope module</span>
        <select
          name="sourceModule"
          value={sourceModule}
          onChange={(e) => setSourceModule(e.target.value)}
          disabled={pending}
        >
          {SOURCE_MODULES.map((opt) => (
            <option key={opt.value || 'all'} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      <label className="settings-field">
        <span>Scope id</span>
        <input
          type="text"
          name="sourceId"
          defaultValue={row?.sourceId ?? ''}
          disabled={pending || !sourceModule}
          autoComplete="off"
          placeholder={sourceModule === 'product:events' ? 'Event id' : 'Optional source id'}
          title="Events: event id. Other modules: catalog id. Empty = whole module."
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

function CreateCouponCard({ defaultCurrency }: { defaultCurrency: string }) {
  const router = useRouter()
  const [state, action, pending] = useActionState(createCouponAction, initial)
  useNotifySavedOnOk(state)
  useEffect(() => {
    if (state.ok) router.refresh()
  }, [state, router])

  return (
    <form action={action} className="page-settings-panel">
      <header className="page-settings-panel-head">
        <h3>New coupon</h3>
      </header>
      <div className="page-settings-panel-body">
        <CouponFields defaultCurrency={defaultCurrency} pending={pending} />
        <Feedback state={state} />
      </div>
      <div className="page-settings-actions">
        <button type="submit" className="gantry-toolbar-btn gantry-toolbar-btn-save" disabled={pending}>
          {pending ? 'Saving…' : 'Create'}
        </button>
      </div>
    </form>
  )
}

function EditCouponCard({
  coupon,
  defaultCurrency,
}: {
  coupon: CouponRecord
  defaultCurrency: string
}) {
  const router = useRouter()
  const [editState, editAction, editPending] = useActionState(updateCouponAction, initial)
  const [activeState, activeAction, activePending] = useActionState(setCouponActiveAction, initial)
  const [deleteState, deleteAction, deletePending] = useActionState(deleteCouponAction, initial)
  useNotifySavedOnOk(editState)
  useNotifySavedOnOk(activeState)
  useEffect(() => {
    if (editState.ok || activeState.ok || deleteState.ok) router.refresh()
  }, [editState, activeState, deleteState, router])

  const pending = editPending || activePending || deletePending
  const used =
    coupon.usageLimit != null
      ? `${coupon.usedCount} / ${coupon.usageLimit}`
      : `${coupon.usedCount} used`

  return (
    <form action={editAction} className="page-settings-panel">
      <header className="page-settings-panel-head">
        <h3>
          {coupon.code}
          {!coupon.active ? ' (inactive)' : ''}
        </h3>
        <p className="settings-hint" title="Redemptions at checkout start">
          {used}
        </p>
      </header>
      <div className="page-settings-panel-body">
        <input type="hidden" name="id" value={coupon.id} />
        <CouponFields row={coupon} defaultCurrency={defaultCurrency} pending={pending} />
        <Feedback state={editState.error ? editState : deleteState.error ? deleteState : activeState} />
      </div>
      <div className="page-settings-actions admin-action-row">
        <button
          type="submit"
          formAction={activeAction}
          name="setActive"
          value={coupon.active ? '0' : '1'}
          className="gantry-toolbar-btn"
          disabled={pending}
        >
          {coupon.active ? 'Deactivate' : 'Activate'}
        </button>
        <button
          type="submit"
          formAction={deleteAction}
          className="gantry-toolbar-btn"
          disabled={pending}
          onClick={(e) => {
            if (!window.confirm(`Delete coupon ${coupon.code}?`)) e.preventDefault()
          }}
        >
          Delete
        </button>
        <button type="submit" className="gantry-toolbar-btn gantry-toolbar-btn-save" disabled={pending}>
          {editPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  )
}

/** Payments coupons admin — shared codes for Events, Shop, Subscriptions, Ads. */
export function CouponsManager({ coupons, defaultCurrency }: Props) {
  return (
    <div className="admin-settings-mosaic sf-payments-coupons">
      <CreateCouponCard defaultCurrency={defaultCurrency} />
      {coupons.map((coupon) => (
        <EditCouponCard key={coupon.id} coupon={coupon} defaultCurrency={defaultCurrency} />
      ))}
    </div>
  )
}
