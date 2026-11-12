'use client'

import React, { useActionState, useEffect, useMemo, useState } from 'react'
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

const FILTER_SCOPES: { value: string; label: string }[] = [
  { value: '__all__', label: 'All scopes' },
  ...SOURCE_MODULES,
]

type SortOrder = 'newest' | 'oldest'

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

function scopeLabel(coupon: CouponRecord): string {
  const mod = (coupon.sourceModule || '').trim()
  const base =
    SOURCE_MODULES.find((opt) => opt.value === mod)?.label ?? (mod || 'Site-wide')
  const sid = (coupon.sourceId || '').trim()
  return sid ? `${base} · ${sid}` : base
}

function discountLabel(coupon: CouponRecord): string {
  const raw = formatCouponDiscountInput({
    mode: coupon.discountMode,
    value: coupon.discountValue,
  })
  if (!raw) return '—'
  if (coupon.discountMode === 'percent') return raw
  const currency = (coupon.currency || '').trim().toUpperCase()
  return currency ? `${raw} ${currency}` : raw
}

function usageLabel(coupon: CouponRecord): string {
  return coupon.usageLimit != null
    ? `${coupon.usedCount} / ${coupon.usageLimit}`
    : `${coupon.usedCount} used`
}

function createdAtMs(coupon: CouponRecord): number {
  const t = new Date(coupon.createdAt).getTime()
  return Number.isFinite(t) ? t : 0
}

function matchesScopeFilter(coupon: CouponRecord, filter: string): boolean {
  if (filter === '__all__') return true
  const mod = (coupon.sourceModule || '').trim()
  return mod === filter
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
    <form action={action} className="page-settings-panel sf-payments-coupons-create">
      <header className="page-settings-panel-head">
        <h3>New coupon</h3>
      </header>
      <div className="page-settings-panel-body">
        <CouponFields defaultCurrency={defaultCurrency} pending={pending} />
        <Feedback state={state} />
        <div className="page-settings-actions">
          <button type="submit" className="gantry-toolbar-btn gantry-toolbar-btn-save" disabled={pending}>
            {pending ? 'Saving…' : 'Create'}
          </button>
        </div>
      </div>
    </form>
  )
}

function EditCouponCard({
  coupon,
  defaultCurrency,
  onCollapse,
}: {
  coupon: CouponRecord
  defaultCurrency: string
  onCollapse: () => void
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

  return (
    <form action={editAction} className="page-settings-panel sf-payments-coupons-edit">
      <header className="page-settings-panel-head">
        <h3>
          {coupon.code}
          {!coupon.active ? ' (inactive)' : ''}
        </h3>
        <p className="settings-hint" title="Redemptions at checkout start">
          {usageLabel(coupon)}
        </p>
      </header>
      <div className="page-settings-panel-body">
        <input type="hidden" name="id" value={coupon.id} />
        <CouponFields row={coupon} defaultCurrency={defaultCurrency} pending={pending} />
        <Feedback state={editState.error ? editState : deleteState.error ? deleteState : activeState} />
        <div className="page-settings-actions admin-action-row">
          <button
            type="button"
            className="gantry-toolbar-btn gantry-toolbar-btn-muted"
            disabled={pending}
            onClick={onCollapse}
          >
            Cancel
          </button>
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
      </div>
    </form>
  )
}

function CouponListItem({
  coupon,
  defaultCurrency,
  expanded,
  onToggle,
}: {
  coupon: CouponRecord
  defaultCurrency: string
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <div className={`sf-payments-coupons-item${expanded ? ' is-expanded' : ''}`}>
      <button
        type="button"
        className="sf-payments-coupons-row"
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <span className="sf-payments-coupons-row-code">{coupon.code}</span>
        <span className="sf-payments-coupons-row-discount">{discountLabel(coupon)}</span>
        <span className="sf-payments-coupons-row-scope">{scopeLabel(coupon)}</span>
        <span className="sf-payments-coupons-row-usage" title="Redemptions at checkout start">
          {usageLabel(coupon)}
        </span>
      </button>
      {expanded ? (
        <EditCouponCard
          coupon={coupon}
          defaultCurrency={defaultCurrency}
          onCollapse={onToggle}
        />
      ) : null}
    </div>
  )
}

function CouponList({
  coupons,
  defaultCurrency,
  openIds,
  onToggle,
  emptyLabel,
}: {
  coupons: CouponRecord[]
  defaultCurrency: string
  openIds: Record<string, true>
  onToggle: (id: string) => void
  emptyLabel: string
}) {
  if (coupons.length === 0) {
    return <p className="admin-empty">{emptyLabel}</p>
  }

  return (
    <div className="sf-payments-coupons-list-items">
      {coupons.map((coupon) => (
        <CouponListItem
          key={coupon.id}
          coupon={coupon}
          defaultCurrency={defaultCurrency}
          expanded={Boolean(openIds[coupon.id])}
          onToggle={() => onToggle(coupon.id)}
        />
      ))}
    </div>
  )
}

/** Payments coupons admin — shared codes for Events, Shop, Subscriptions, Ads. */
export function CouponsManager({ coupons, defaultCurrency }: Props) {
  const [scopeFilter, setScopeFilter] = useState('__all__')
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest')
  const [openIds, setOpenIds] = useState<Record<string, true>>({})

  const filteredSorted = useMemo(() => {
    const filtered = coupons.filter((c) => matchesScopeFilter(c, scopeFilter))
    const dir = sortOrder === 'newest' ? -1 : 1
    return [...filtered].sort((a, b) => dir * (createdAtMs(a) - createdAtMs(b)))
  }, [coupons, scopeFilter, sortOrder])

  const activeCoupons = useMemo(
    () => filteredSorted.filter((c) => c.active),
    [filteredSorted],
  )
  const inactiveCoupons = useMemo(
    () => filteredSorted.filter((c) => !c.active),
    [filteredSorted],
  )

  const toggleOpen = (id: string) => {
    setOpenIds((prev) => {
      if (prev[id]) {
        const next = { ...prev }
        delete next[id]
        return next
      }
      return { ...prev, [id]: true }
    })
  }

  return (
    <div className="sf-payments-coupons">
      <div className="sf-payments-coupons-toolbar admin-inline-actions" role="toolbar" aria-label="Coupon filters">
        <label className="settings-field">
          <span>Scope</span>
          <select
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value)}
            title="Filter coupons by scope module"
          >
            {FILTER_SCOPES.map((opt) => (
              <option key={opt.value || 'site'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="settings-field">
          <span>Sort</span>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as SortOrder)}
            title="Order by created date"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>
      </div>

      <div className="sf-payments-coupons-main">
        <CreateCouponCard defaultCurrency={defaultCurrency} />
        <section className="sf-payments-coupons-list sf-payments-coupons-list-active" aria-label="Active coupons">
          <header className="sf-payments-coupons-list-head">
            <h3>Active coupons</h3>
          </header>
          <CouponList
            coupons={activeCoupons}
            defaultCurrency={defaultCurrency}
            openIds={openIds}
            onToggle={toggleOpen}
            emptyLabel="No active coupons match this filter."
          />
        </section>
      </div>

      <section className="sf-payments-coupons-list sf-payments-coupons-list-inactive" aria-label="Deactivated coupons">
        <header className="sf-payments-coupons-list-head">
          <h3>Deactivated</h3>
        </header>
        <CouponList
          coupons={inactiveCoupons}
          defaultCurrency={defaultCurrency}
          openIds={openIds}
          onToggle={toggleOpen}
          emptyLabel="No deactivated coupons."
        />
      </section>
    </div>
  )
}
