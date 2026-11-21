'use client'

import React, { useActionState, useEffect, useId, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'
import { getAdminOverlayPortalTarget } from '@/components/admin/useFloatingSettingsPanel'

import {
  adminCompPeriodAction,
  exportPeriodsCsvAction,
  updatePeriodAction,
  type SubscriptionsActionState,
} from '../actions'
import {
  audienceMatchesSubtype,
  planSubjectBucket,
  planSubjectLabel,
  planTypeSummary,
  PLAN_TYPE_OPTIONS,
  subtypesForPlanType,
} from '../catalog'
import { PLAN_SUBJECTS, type SubscriptionPlanRecord } from '../types'

const initial: SubscriptionsActionState = {}

export type SubscriberPeriodView = {
  id: string
  planId: string
  userId: string
  status: string
  startsAt: string
  endsAt: string
  createdAt: string
  orderId: string
  subject: string
  audience: string
  source: string
}

export type SubscriberPerson = {
  name: string
  handle: string
}

type RangeKey = 'all' | 'current' | 'start_30' | 'start_90' | 'this_year' | 'ending_30'
type SortKey = 'newest' | 'oldest' | 'ending' | 'subscriber'
type StatusKey = 'all' | 'active' | 'expired' | 'refunded'

type DialogState = { mode: 'add' } | { mode: 'edit'; id: string } | null

type Props = {
  periods: SubscriberPeriodView[]
  plans: SubscriptionPlanRecord[]
  people: Record<string, SubscriberPerson>
}

const DAY = 86_400_000

function timeMs(value: string): number {
  const t = new Date(value).getTime()
  return Number.isFinite(t) ? t : 0
}

function dayLabel(value: string): string {
  const t = timeMs(value)
  if (!t) return '—'
  return new Date(t).toISOString().slice(0, 10)
}

function subscriberLabel(userId: string, people: Record<string, SubscriberPerson>): string {
  const person = people[userId]
  const name = person?.name?.trim() || ''
  const handle = person?.handle?.trim() || ''
  if (name && handle) return `${name} (@${handle})`
  if (name) return name
  if (handle) return `@${handle}`
  return userId
}

function sourceLabel(source: string): string {
  if (source === 'admin_comp') return 'Comp'
  if (source === 'purchase') return 'Checkout'
  if (source === 'free') return 'Free'
  if (source === 'trial') return 'Trial'
  if (source === 'upgrade') return 'Upgrade'
  return source || '—'
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

function ExportCsvButton() {
  const [state, action, pending] = useActionState(exportPeriodsCsvAction, initial)

  useEffect(() => {
    if (!state.csv) return
    const blob = new Blob([state.csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `subscriptions-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [state.csv])

  return (
    <form action={action}>
      <button type="submit" className="gantry-toolbar-btn gantry-toolbar-btn-muted" disabled={pending}>
        {pending ? 'Exporting…' : 'Export CSV'}
      </button>
      {state.error ? (
        <p className="admin-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}

function FilterChip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      className={`gantry-toolbar-btn gantry-toolbar-btn-muted${pressed ? ' is-active' : ''}`}
      aria-pressed={pressed}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function inRange(period: SubscriberPeriodView, range: RangeKey, now: number): boolean {
  const start = timeMs(period.startsAt)
  const end = timeMs(period.endsAt)
  if (range === 'all') return true
  if (range === 'current') return period.status === 'active' && start <= now && end > now
  if (range === 'start_30') return start >= now - 30 * DAY
  if (range === 'start_90') return start >= now - 90 * DAY
  if (range === 'this_year') {
    const year = new Date(now).getUTCFullYear()
    return start >= Date.UTC(year, 0, 1)
  }
  if (range === 'ending_30') {
    return period.status === 'active' && end >= now && end <= now + 30 * DAY
  }
  return true
}

function FormDialog({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  const titleId = useId()
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setPortalTarget(getAdminOverlayPortalTarget())
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!portalTarget) return null

  return createPortal(
    <div
      className="sf-admin-confirm-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className="sf-admin-confirm-dialog sf-admin-form-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="sf-admin-confirm-head">
          <h3 id={titleId}>{title}</h3>
        </header>
        {children}
      </div>
    </div>,
    portalTarget,
  )
}

function AddSubscriptionDialog({
  plans,
  onClose,
}: {
  plans: SubscriptionPlanRecord[]
  onClose: () => void
}) {
  const router = useRouter()
  const [state, action, pending] = useActionState(adminCompPeriodAction, initial)
  useNotifySavedOnOk(state)
  useEffect(() => {
    if (!state.ok) return
    onClose()
    router.refresh()
  }, [state.ok, onClose, router])

  const groups = PLAN_TYPE_OPTIONS.map((opt) => ({
    ...opt,
    plans: plans.filter((plan) => planSubjectBucket(plan.subject) === opt.id),
  })).filter((group) => group.plans.length > 0)

  return (
    <FormDialog title="Add subscription" onClose={onClose}>
      <form action={action} className="sf-admin-form-dialog-body" id="sf-subscriptions-add-dialog">
        <p className="settings-hint">Grants a period without checkout. Extends an active period for the same plan.</p>
        <label className="settings-field">
          <span>Plan</span>
          <select name="planId" required disabled={pending || plans.length === 0}>
            <option value="">Select plan</option>
            {groups.map((group) => (
              <optgroup key={group.id} label={group.label}>
                {group.plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.title}
                    {plan.active ? '' : ' (inactive)'}
                  </option>
                ))}
              </optgroup>
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
          <span className="settings-hint">The list shows the profile name when Profiles can resolve it.</span>
        </label>
        <Feedback state={state} />
        <div className="page-settings-actions sf-events-form-actions">
          <button
            type="button"
            className="gantry-toolbar-btn gantry-toolbar-btn-muted"
            disabled={pending}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="gantry-toolbar-btn gantry-toolbar-btn-save"
            disabled={pending || plans.length === 0}
          >
            {pending ? 'Saving…' : 'Add'}
          </button>
        </div>
      </form>
    </FormDialog>
  )
}

function EditSubscriptionDialog({
  period,
  planTitle,
  personLabel,
  onClose,
}: {
  period: SubscriberPeriodView
  planTitle: string
  personLabel: string
  onClose: () => void
}) {
  const router = useRouter()
  const [state, action, pending] = useActionState(updatePeriodAction, initial)
  useNotifySavedOnOk(state)
  useEffect(() => {
    if (!state.ok) return
    onClose()
    router.refresh()
  }, [state.ok, onClose, router])

  const refunded = period.status === 'refunded'
  const status = period.status === 'expired' ? 'expired' : 'active'
  const endsValue = dayLabel(period.endsAt)
  const endsInput = /^\d{4}-\d{2}-\d{2}$/.test(endsValue) ? endsValue : ''

  return (
    <FormDialog title="Edit subscription" onClose={onClose}>
      <form action={action} className="sf-admin-form-dialog-body">
        <input type="hidden" name="id" value={period.id} />
        <label className="settings-field">
          <span>Subscriber</span>
          <input type="text" value={personLabel} disabled readOnly />
          <span className="settings-hint">{period.userId}</span>
        </label>
        <label className="settings-field">
          <span>Plan</span>
          <input type="text" value={planTitle} disabled readOnly />
        </label>
        <label className="settings-field">
          <span>Type</span>
          <input type="text" value={planTypeSummary(period.subject, period.audience)} disabled readOnly />
        </label>
        <label className="settings-field">
          <span>Starts</span>
          <input type="text" value={dayLabel(period.startsAt)} disabled readOnly />
        </label>
        {refunded ? (
          <p className="settings-hint">Refunded periods stay closed. Payments owns refunds.</p>
        ) : (
          <>
            <label className="settings-field">
              <span>Status</span>
              <select name="status" defaultValue={status} disabled={pending}>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
              </select>
            </label>
            <label className="settings-field">
              <span>Ends</span>
              <input type="date" name="endsAt" required defaultValue={endsInput} disabled={pending} />
            </label>
          </>
        )}
        <p className="settings-hint">
          {sourceLabel(period.source)}
          {period.orderId ? ` · order ${period.orderId}` : ''}
        </p>
        <Feedback state={state} />
        <div className="page-settings-actions sf-events-form-actions">
          <button
            type="button"
            className="gantry-toolbar-btn gantry-toolbar-btn-muted"
            disabled={pending}
            onClick={onClose}
          >
            {refunded ? 'Close' : 'Cancel'}
          </button>
          {refunded ? null : (
            <button type="submit" className="gantry-toolbar-btn gantry-toolbar-btn-save" disabled={pending}>
              {pending ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>
      </form>
    </FormDialog>
  )
}

export function SubscribersManager({ periods, plans, people }: Props) {
  const [typeId, setTypeId] = useState('')
  const [subtypeId, setSubtypeId] = useState('')
  const [status, setStatus] = useState<StatusKey>('all')
  const [range, setRange] = useState<RangeKey>('all')
  const [sort, setSort] = useState<SortKey>('newest')
  const [query, setQuery] = useState('')
  const [dialog, setDialog] = useState<DialogState>(null)
  const now = useMemo(() => Date.now(), [periods])

  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const opt of PLAN_TYPE_OPTIONS) counts.set(opt.id, 0)
    for (const period of periods) {
      const bucket = planSubjectBucket(period.subject)
      counts.set(bucket, (counts.get(bucket) ?? 0) + 1)
    }
    return counts
  }, [periods])

  const subtypeOptions = useMemo(() => {
    if (!typeId) return []
    const known = subtypesForPlanType(typeId)
    if (known.length > 0) return known
    const values = new Set<string>()
    for (const period of periods) {
      if (planSubjectBucket(period.subject) !== typeId) continue
      const audience = period.audience.trim()
      if (audience) values.add(audience)
    }
    return [...values].sort().map((value) => ({ value, label: value }))
  }, [periods, typeId])

  const planTitle = (id: string) => plans.find((plan) => plan.id === id)?.title || id

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = periods.filter((period) => {
      if (typeId && planSubjectBucket(period.subject) !== typeId) return false
      if (subtypeId && !audienceMatchesSubtype(period.subject, period.audience, subtypeId)) return false
      if (status !== 'all' && period.status !== status) return false
      if (!inRange(period, range, now)) return false
      if (!q) return true
      const person = people[period.userId]
      const hay = [period.userId, person?.name, person?.handle].filter(Boolean).join(' ').toLowerCase()
      return hay.includes(q)
    })
    return [...filtered].sort((a, b) => {
      if (sort === 'oldest') return timeMs(a.createdAt) - timeMs(b.createdAt)
      if (sort === 'ending') return timeMs(a.endsAt) - timeMs(b.endsAt)
      if (sort === 'subscriber') {
        return subscriberLabel(a.userId, people).localeCompare(subscriberLabel(b.userId, people))
      }
      return timeMs(b.createdAt) - timeMs(a.createdAt)
    })
  }, [periods, people, typeId, subtypeId, status, range, sort, query, now])

  const editing = dialog?.mode === 'edit' ? periods.find((period) => period.id === dialog.id) : null
  const addOpen = dialog?.mode === 'add'

  return (
    <div className="sf-subscriptions-periods">
      <section className="outlines-create sf-events-add-panel" aria-label="Add subscription">
        <div className="sf-events-add-bar">
          <button
            type="button"
            className={`gantry-toolbar-btn${addOpen ? ' gantry-toolbar-btn-muted' : ' gantry-toolbar-btn-save'}`}
            aria-expanded={addOpen}
            aria-controls="sf-subscriptions-add-dialog"
            disabled={plans.length === 0}
            title={plans.length === 0 ? 'Create a plan first' : 'Grant a period without checkout'}
            onClick={() => setDialog(addOpen ? null : { mode: 'add' })}
          >
            {addOpen ? 'Close' : 'Add +'}
          </button>
          <ExportCsvButton />
          {!addOpen ? (
            <p className="settings-hint sf-events-add-hint">
              Grant a period without checkout. Edit one subscription at a time. Coupons live under{' '}
              <a href="/admin/payments/coupons">Payments → Coupons</a>; mail under{' '}
              <a href="/admin/email">Email</a>.
            </p>
          ) : null}
        </div>
      </section>

      <section className="outlines-create" aria-label="Filter subscriptions">
        <h3>Filter</h3>
        <div className="sf-subscriptions-filterbar">
          <div className="sf-events-filters">
            <div className="sf-events-filter-group" role="group" aria-label="Type">
              <FilterChip
                pressed={typeId === ''}
                onClick={() => {
                  setTypeId('')
                  setSubtypeId('')
                }}
              >
                All ({periods.length})
              </FilterChip>
              {PLAN_TYPE_OPTIONS.map((opt) => (
                <FilterChip
                  key={opt.id}
                  pressed={typeId === opt.id}
                  onClick={() => {
                    setTypeId(opt.id)
                    setSubtypeId('')
                  }}
                >
                  {opt.label} ({typeCounts.get(opt.id) ?? 0})
                </FilterChip>
              ))}
            </div>
            {typeId && subtypeOptions.length > 0 ? (
              <div className="sf-events-filter-group" role="group" aria-label="Subtype">
                <FilterChip pressed={subtypeId === ''} onClick={() => setSubtypeId('')}>
                  All subtypes
                </FilterChip>
                {subtypeOptions.map((opt) => (
                  <FilterChip
                    key={opt.value}
                    pressed={subtypeId === opt.value}
                    onClick={() => setSubtypeId(opt.value)}
                  >
                    {opt.label}
                  </FilterChip>
                ))}
              </div>
            ) : null}
            <div className="sf-events-filter-group" role="group" aria-label="Status">
              {(['all', 'active', 'expired', 'refunded'] as const).map((key) => (
                <FilterChip key={key} pressed={status === key} onClick={() => setStatus(key)}>
                  {key === 'all' ? 'All statuses' : key}
                </FilterChip>
              ))}
            </div>
          </div>
          <label className="settings-field">
            <span>Time range</span>
            <select value={range} onChange={(e) => setRange(e.target.value as RangeKey)}>
              <option value="all">All time</option>
              <option value="current">Current</option>
              <option value="start_30">Started in 30 days</option>
              <option value="start_90">Started in 90 days</option>
              <option value="this_year">Started this year</option>
              <option value="ending_30">Ending in 30 days</option>
            </select>
          </label>
          <label className="settings-field">
            <span>Order</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="ending">Ending soon</option>
              <option value="subscriber">Subscriber</option>
            </select>
          </label>
          <label className="settings-field">
            <span>Subscriber</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, handle, or user id"
              autoComplete="off"
            />
          </label>
        </div>
      </section>

      <section className="outlines-create" aria-label="Subscriptions">
        <h3>Subscriptions</h3>
        {visible.length === 0 ? (
          <p className="admin-empty">
            {periods.length === 0
              ? 'No subscriptions yet. Use Add + to grant one.'
              : `No subscriptions${typeId ? ` for ${planSubjectLabel(typeId)}` : ''} match this filter.`}
          </p>
        ) : (
          <div className="outlines-table-wrap">
            <table className="outlines-table">
              <thead>
                <tr>
                  <th scope="col">Subscriber</th>
                  <th scope="col">Plan</th>
                  <th scope="col">Type</th>
                  <th scope="col">Status</th>
                  <th scope="col">Starts</th>
                  <th scope="col">Ends</th>
                  <th scope="col">Source</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((period) => {
                  const label = subscriberLabel(period.userId, people)
                  return (
                    <tr key={period.id}>
                      <td title={period.userId}>{label}</td>
                      <td>{planTitle(period.planId)}</td>
                      <td>{planTypeSummary(period.subject, period.audience)}</td>
                      <td>{period.status}</td>
                      <td>{dayLabel(period.startsAt)}</td>
                      <td>{dayLabel(period.endsAt)}</td>
                      <td>{sourceLabel(period.source)}</td>
                      <td>
                        <div className="admin-action-row sf-events-list-row-actions">
                          <button
                            type="button"
                            className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                            onClick={() => setDialog({ mode: 'edit', id: period.id })}
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {addOpen ? <AddSubscriptionDialog plans={plans} onClose={() => setDialog(null)} /> : null}
      {editing ? (
        <EditSubscriptionDialog
          period={editing}
          planTitle={planTitle(editing.planId)}
          personLabel={subscriberLabel(editing.userId, people)}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </div>
  )
}
