'use client'

import React, { useActionState, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'
import type { ContentLocaleOption } from '@/core/i18n/locale-text'
import { LocaleInput } from '@/core/localization/LocaleInput'

import {
  audienceMatchesSubtype,
  defaultAudienceForSubject,
  canonicalPlanAudience,
  planSubjectBucket,
  planSubjectLabel,
  planTypeSummary,
  PLAN_TYPE_OPTIONS,
  subtypesForPlanType,
  type PlanSubtypeOption,
} from '../catalog'
import {
  createPlanAction,
  setPlanActiveAction,
  updatePlanAction,
  type SubscriptionsActionState,
} from '../actions'
import {
  defaultEntitlementKeysForSubject,
  PLAN_SUBJECTS,
  type SubscriptionPlanRecord,
} from '../types'

const initial: SubscriptionsActionState = {}

type PlanSort = 'catalog' | 'newest' | 'title' | 'price'
type PlanStatusFilter = 'all' | 'active' | 'inactive'

export type PlanGroupOption = { id: string; label: string }

export type PlanAdminRow = SubscriptionPlanRecord & {
  titleLocales: Record<string, string>
  descriptionLocales: Record<string, string>
}

type Props = {
  plans: PlanAdminRow[]
  currency: string
  initialType?: string
  defaultGraceHours?: number
  defaultFormDefinitionId?: string
  groupOptions?: PlanGroupOption[]
  locales?: ContentLocaleOption[]
}

function timeMs(value: Date | string | undefined): number {
  if (!value) return 0
  const t = value instanceof Date ? value.getTime() : new Date(value).getTime()
  return Number.isFinite(t) ? t : 0
}

function initialTypeId(raw: string | undefined): string {
  const t = (raw ?? '').trim()
  if (!t) return ''
  if (PLAN_TYPE_OPTIONS.some((opt) => opt.id === t)) return t
  return PLAN_SUBJECTS.other
}

function priceLabel(plan: SubscriptionPlanRecord, currency: string): string {
  if (plan.price <= 0) return `Free / ${plan.billingPeriod}`
  return `${plan.price} ${currency} / ${plan.billingPeriod}`
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

function PlanFields({
  row,
  pending,
  defaultGraceHours = 0,
  defaultFormDefinitionId = 'subscription-registration',
  groupOptions = [],
  locales = [],
}: {
  row?: PlanAdminRow
  pending: boolean
  defaultGraceHours?: number
  defaultFormDefinitionId?: string
  groupOptions?: PlanGroupOption[]
  locales?: ContentLocaleOption[]
}) {
  const [subject, setSubject] = useState(row?.subject || PLAN_SUBJECTS.membership)
  const [audience, setAudience] = useState(
    row ? canonicalPlanAudience(row.subject, row.audience) : defaultAudienceForSubject(PLAN_SUBJECTS.membership),
  )
  const defaultCode = locales.find((l) => l.isDefault)?.code || locales[0]?.code || ''
  const [title, setTitle] = useState(row?.title ?? '')
  const [titleLocales, setTitleLocales] = useState<Record<string, string>>(row?.titleLocales ?? {})
  const [description, setDescription] = useState(row?.description ?? '')
  const [descriptionLocales, setDescriptionLocales] = useState<Record<string, string>>(
    row?.descriptionLocales ?? {},
  )
  const formDeepLinkId = (row?.formDefinitionId || defaultFormDefinitionId || '').trim()
  const typeOptions = PLAN_TYPE_OPTIONS.some((opt) => opt.id === subject)
    ? PLAN_TYPE_OPTIONS
    : [...PLAN_TYPE_OPTIONS, { id: subject, label: planSubjectLabel(subject) }]
  const subtypes = subtypesForPlanType(planSubjectBucket(subject))
  const options: PlanSubtypeOption[] =
    audience && !subtypes.some((opt) => opt.value === audience)
      ? [{ value: audience, label: audience }, ...subtypes]
      : subtypes
  const brandHint =
    subject === PLAN_SUBJECTS.organizer && audience === 'brand'
      ? 'A brand that owns a managed page — a site page that operates as their website.'
      : ''

  return (
    <div className="sf-subscriptions-plan-sections">
      <fieldset className="sf-subscriptions-plan-section">
        <legend>Basics</legend>
        <div className="sf-subscriptions-plan-fields">
          <label className="settings-field">
            <span>Type</span>
            <select
              name="subject"
              value={subject}
              disabled={pending}
              onChange={(e) => {
                const next = e.target.value
                setSubject(next)
                setAudience(defaultAudienceForSubject(next))
              }}
            >
              {typeOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          {options.length > 0 ? (
            <label className="settings-field">
              <span>Subtype</span>
              <select
                name="audience"
                value={audience}
                disabled={pending}
                onChange={(e) => setAudience(e.target.value)}
              >
                {options.map((opt) => (
                  <option key={opt.value} value={opt.value} title={opt.title}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {brandHint ? <span className="settings-hint">{brandHint}</span> : null}
            </label>
          ) : (
            <label className="settings-field">
              <span>Subtype</span>
              <input
                type="text"
                name="audience"
                value={audience}
                disabled={pending}
                onChange={(e) => setAudience(e.target.value)}
                autoComplete="off"
                placeholder="Optional"
              />
            </label>
          )}
          {locales.length > 0 ? (
            <>
              <input type="hidden" name="title" value={title} />
              <input type="hidden" name="description" value={description} />
              <input type="hidden" name="titleLocales" value={JSON.stringify(titleLocales)} />
              <input
                type="hidden"
                name="descriptionLocales"
                value={JSON.stringify(descriptionLocales)}
              />
              <div className="sf-subscriptions-plan-field-wide">
                <LocaleInput
                  locales={locales}
                  label="Title"
                  requiredDefault
                  values={{
                    ...titleLocales,
                    ...(defaultCode ? { [defaultCode]: title } : {}),
                  }}
                  onChange={(code, value) => {
                    setTitleLocales((prev) => ({ ...prev, [code]: value }))
                    if (code === defaultCode) setTitle(value)
                  }}
                />
              </div>
              <label className="settings-field">
                <span>Sort</span>
                <input type="number" name="sortOrder" defaultValue={row?.sortOrder ?? 0} disabled={pending} />
              </label>
              <div className="sf-subscriptions-plan-field-wide">
                <LocaleInput
                  locales={locales}
                  label="Description"
                  multiline
                  rows={2}
                  values={{
                    ...descriptionLocales,
                    ...(defaultCode ? { [defaultCode]: description } : {}),
                  }}
                  onChange={(code, value) => {
                    setDescriptionLocales((prev) => ({ ...prev, [code]: value }))
                    if (code === defaultCode) setDescription(value)
                  }}
                />
                <p className="settings-hint">
                  Other languages sync to{' '}
                  <code>data/content-locales/{'{locale}'}/subscriptions/{'{id}'}.json</code> and can
                  also be edited under <Link href="/admin/localization">Localization</Link>.
                </p>
              </div>
            </>
          ) : (
            <>
              <label className="settings-field">
                <span>Title</span>
                <input
                  type="text"
                  name="title"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={pending}
                  autoComplete="off"
                />
              </label>
              <label className="settings-field">
                <span>Sort</span>
                <input type="number" name="sortOrder" defaultValue={row?.sortOrder ?? 0} disabled={pending} />
              </label>
              <label className="settings-field sf-subscriptions-plan-field-wide">
                <span>Description</span>
                <textarea
                  name="description"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={pending}
                />
              </label>
            </>
          )}
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
        </div>
      </fieldset>

      <fieldset className="sf-subscriptions-plan-section">
        <legend>Pricing</legend>
        <div className="sf-subscriptions-plan-fields">
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
            <span className="settings-hint">0 = free plan (no Payments cart).</span>
          </label>
          <label className="settings-field">
            <span>Billing period</span>
            <select name="billingPeriod" defaultValue={row?.billingPeriod || 'month'} disabled={pending}>
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
              <option value="year">Year</option>
              <option value="lifetime">Lifetime</option>
            </select>
          </label>
          <label className="settings-field settings-flag sf-subscriptions-plan-field-wide">
            <span>Recurring supported</span>
            <input
              type="checkbox"
              name="recurringSupported"
              value="1"
              defaultChecked={row?.recurringSupported ?? false}
              disabled={pending}
            />
            <span className="settings-hint">Payments owns gateway renew; this only opts the plan in.</span>
          </label>
        </div>
      </fieldset>

      <fieldset className="sf-subscriptions-plan-section">
        <legend>Trial</legend>
        <div className="sf-subscriptions-plan-fields">
          <label className="settings-field">
            <span>Trial days</span>
            <input
              type="number"
              name="trialDurationDays"
              min={0}
              step={1}
              defaultValue={row?.trialDurationDays ?? 0}
              disabled={pending}
            />
          </label>
          <label className="settings-field">
            <span>Trial price (major)</span>
            <input
              type="number"
              name="trialPrice"
              min={0}
              step={1}
              defaultValue={row?.trialPrice ?? 0}
              disabled={pending}
            />
          </label>
          <label className="settings-field settings-flag">
            <span>Trial once per user</span>
            <input
              type="checkbox"
              name="trialOnce"
              value="1"
              defaultChecked={row ? row.trialOnce : true}
              disabled={pending}
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="sf-subscriptions-plan-section">
        <legend>Renewal &amp; limits</legend>
        <div className="sf-subscriptions-plan-fields">
          <label className="settings-field">
            <span>Early renew days</span>
            <input
              type="number"
              name="earlyRenewDays"
              min={0}
              step={1}
              defaultValue={row?.earlyRenewDays ?? 0}
              disabled={pending}
            />
          </label>
          <label className="settings-field">
            <span>Early renew price (major, empty = list)</span>
            <input
              type="number"
              name="earlyRenewPrice"
              min={0}
              step={1}
              defaultValue={row?.earlyRenewPrice ?? ''}
              disabled={pending}
            />
          </label>
          <label className="settings-field">
            <span>Grace hours</span>
            <input
              type="number"
              name="graceHours"
              min={0}
              step={1}
              defaultValue={row?.graceHours ?? defaultGraceHours}
              disabled={pending}
            />
          </label>
          <label className="settings-field">
            <span>Max active (0 = unlimited)</span>
            <input
              type="number"
              name="maxActive"
              min={0}
              step={1}
              defaultValue={row?.maxActive ?? 0}
              disabled={pending}
            />
          </label>
          <label className="settings-field">
            <span>Fixed expiry</span>
            <input
              type="date"
              name="fixedExpiresAt"
              defaultValue={
                row?.fixedExpiresAt ? row.fixedExpiresAt.toISOString().slice(0, 10) : ''
              }
              disabled={pending}
            />
          </label>
          <label className="settings-field sf-subscriptions-plan-field-wide">
            <span>Upgrade target plan ids</span>
            <input
              type="text"
              name="upgradeTargetIds"
              defaultValue={row?.upgradeTargetIds?.join(', ') ?? ''}
              disabled={pending}
              placeholder="Comma-separated plan ids"
              autoComplete="off"
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="sf-subscriptions-plan-section">
        <legend>Access</legend>
        <div className="sf-subscriptions-plan-fields">
          <label className="settings-field">
            <span>Seat limit (0 = none)</span>
            <input
              type="number"
              name="seatLimit"
              min={0}
              step={1}
              defaultValue={row?.seatLimit ?? 0}
              disabled={pending}
            />
          </label>
          <label className="settings-field">
            <span>Forms definition id</span>
            <input
              type="text"
              name="formDefinitionId"
              defaultValue={row?.formDefinitionId || (!row ? defaultFormDefinitionId : '')}
              disabled={pending}
              placeholder={defaultFormDefinitionId}
              autoComplete="off"
            />
            <span className="settings-hint">
              Forms owns the field schema.{' '}
              {formDeepLinkId ? (
                <Link href={`/admin/forms/${encodeURIComponent(formDeepLinkId)}`}>
                  Edit registration form
                </Link>
              ) : (
                <Link href="/admin/forms">Open Forms</Link>
              )}
            </span>
          </label>
          <label className="settings-field sf-subscriptions-plan-field-wide">
            <span>Entitlement keys</span>
            <input
              key={`${row?.id ?? 'new'}:${subject}`}
              type="text"
              name="entitlementKeys"
              defaultValue={
                row && row.subject === subject
                  ? row.entitlementKeys.join(', ')
                  : defaultEntitlementKeysForSubject(subject).join(', ')
              }
              disabled={pending}
              title="Comma-separated. Empty uses type defaults."
              placeholder="events.member"
            />
            <span className="settings-hint">Comma-separated. Empty uses type defaults.</span>
          </label>
          <label className="settings-field sf-subscriptions-plan-field-wide">
            <span>Access groups</span>
            <input type="hidden" name="groupIdsField" value="1" />
            {groupOptions.length > 0 ? (
              <select
                name="groupIds"
                multiple
                size={Math.min(6, Math.max(3, groupOptions.length))}
                defaultValue={row?.groupIds ?? []}
                disabled={pending}
              >
                {groupOptions.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                name="groupIds"
                defaultValue={row?.groupIds?.join(', ') ?? ''}
                disabled={pending}
                placeholder="No groups yet — create under Users"
                autoComplete="off"
              />
            )}
            <span className="settings-hint">
              Subscriber is added to these Core groups while the period is active. Pages, nav, and
              modules use group ACL. Manage groups under{' '}
              <Link href="/admin/users">Users / ACL</Link>. Hold Ctrl/Cmd to select multiple —
              deselect all and Save to clear.
            </span>
          </label>
        </div>
      </fieldset>
    </div>
  )
}

function CreatePlanCard({
  currency,
  defaultGraceHours,
  defaultFormDefinitionId,
  groupOptions,
  locales,
}: {
  currency: string
  defaultGraceHours: number
  defaultFormDefinitionId: string
  groupOptions: PlanGroupOption[]
  locales: ContentLocaleOption[]
}) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const [state, action, pending] = useActionState(createPlanAction, initial)
  useNotifySavedOnOk(state)
  useEffect(() => {
    if (!state.ok) return
    setCreateOpen(false)
    setFormKey((k) => k + 1)
    router.refresh()
  }, [state.ok, router])

  return (
    <section
      className={`outlines-create sf-events-add-panel sf-subscriptions-add-panel${createOpen ? ' is-open' : ''}`}
      aria-label="Add plan"
    >
      <h3>Add plan</h3>
      <div className="sf-events-add-bar">
        <button
          type="button"
          className={`gantry-toolbar-btn${createOpen ? ' gantry-toolbar-btn-muted' : ' gantry-toolbar-btn-save'}`}
          aria-expanded={createOpen}
          aria-controls="sf-subscriptions-add-plan-form"
          onClick={() => setCreateOpen((open) => !open)}
        >
          {createOpen ? 'Close' : 'Add +'}
        </button>
        {!createOpen ? (
          <p className="settings-hint sf-events-add-hint">
            Click Add + to extend the form — currency {currency}. Checkout re-reads the price.
          </p>
        ) : null}
      </div>
      {createOpen ? (
        <form key={formKey} id="sf-subscriptions-add-plan-form" action={action} aria-label="Create plan">
          <PlanFields
            pending={pending}
            defaultGraceHours={defaultGraceHours}
            defaultFormDefinitionId={defaultFormDefinitionId}
            groupOptions={groupOptions}
            locales={locales}
          />
          <Feedback state={state} />
          <div className="page-settings-actions sf-events-form-actions">
            <button
              type="button"
              className="gantry-toolbar-btn gantry-toolbar-btn-muted"
              disabled={pending}
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="gantry-toolbar-btn gantry-toolbar-btn-save" disabled={pending}>
              {pending ? 'Saving…' : 'Create'}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  )
}

function EditPlanForm({
  plan,
  onClose,
  groupOptions,
  locales,
}: {
  plan: PlanAdminRow
  onClose: () => void
  groupOptions: PlanGroupOption[]
  locales: ContentLocaleOption[]
}) {
  const router = useRouter()
  const [state, action, pending] = useActionState(updatePlanAction, initial)
  const [activeState, activeAction, activePending] = useActionState(setPlanActiveAction, initial)
  useNotifySavedOnOk(state)
  useNotifySavedOnOk(activeState)
  useEffect(() => {
    if (state.ok || activeState.ok) router.refresh()
  }, [state.ok, activeState.ok, router])

  const busy = pending || activePending

  return (
    <form action={action} className="sf-subscriptions-plan-edit">
      <input type="hidden" name="id" value={plan.id} />
      <PlanFields row={plan} pending={busy} groupOptions={groupOptions} locales={locales} />
      <Feedback state={state.error ? state : activeState} />
      <div className="page-settings-actions sf-events-form-actions">
        <button
          type="button"
          className="gantry-toolbar-btn gantry-toolbar-btn-muted"
          disabled={busy}
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="submit"
          formAction={activeAction}
          name="setActive"
          value={plan.active ? '0' : '1'}
          className="gantry-toolbar-btn"
          disabled={busy}
        >
          {plan.active ? 'Deactivate' : 'Activate'}
        </button>
        <button type="submit" className="gantry-toolbar-btn gantry-toolbar-btn-save" disabled={busy}>
          {pending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  )
}

function PlanRow({
  plan,
  currency,
  open,
  onToggle,
  groupOptions,
  locales,
}: {
  plan: PlanAdminRow
  currency: string
  open: boolean
  onToggle: () => void
  groupOptions: PlanGroupOption[]
  locales: ContentLocaleOption[]
}) {
  return (
    <div
      className={`sf-subscriptions-plan-item${open ? ' is-open' : ''}${plan.active ? '' : ' is-inactive'}`}
    >
      <div className="sf-subscriptions-plan-row">
        <span className="sf-subscriptions-plan-title">{plan.title}</span>
        <span className="sf-subscriptions-plan-meta">{planTypeSummary(plan.subject, plan.audience)}</span>
        <span className="sf-subscriptions-plan-meta">{priceLabel(plan, currency)}</span>
        <span
          className={`sf-subscriptions-plan-status${plan.active ? ' is-active' : ' is-inactive'}`}
        >
          {plan.active ? 'Active' : 'Inactive'}
        </span>
        <div className="admin-action-row sf-events-list-row-actions">
          <button
            type="button"
            className="gantry-toolbar-btn gantry-toolbar-btn-muted"
            aria-expanded={open}
            onClick={onToggle}
          >
            {open ? 'Close' : 'Edit'}
          </button>
        </div>
      </div>
      {open ? (
        <EditPlanForm
          plan={plan}
          onClose={onToggle}
          groupOptions={groupOptions}
          locales={locales}
        />
      ) : null}
    </div>
  )
}

export function PlansManager({
  plans,
  currency,
  initialType,
  defaultGraceHours = 0,
  defaultFormDefinitionId = 'subscription-registration',
  groupOptions = [],
  locales = [],
}: Props) {
  const [typeId, setTypeId] = useState(() => initialTypeId(initialType))
  const [subtypeId, setSubtypeId] = useState('')
  const [status, setStatus] = useState<PlanStatusFilter>('all')
  const [sort, setSort] = useState<PlanSort>('catalog')
  const [openId, setOpenId] = useState<string | null>(null)

  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const opt of PLAN_TYPE_OPTIONS) counts.set(opt.id, 0)
    for (const plan of plans) {
      const bucket = planSubjectBucket(plan.subject)
      counts.set(bucket, (counts.get(bucket) ?? 0) + 1)
    }
    return counts
  }, [plans])

  const subtypeOptions = useMemo(() => {
    if (!typeId) return []
    const known = subtypesForPlanType(typeId)
    if (known.length > 0) return known
    const values = new Set<string>()
    for (const plan of plans) {
      if (planSubjectBucket(plan.subject) !== typeId) continue
      const audience = plan.audience.trim()
      if (audience) values.add(audience)
    }
    return [...values].sort().map((value) => ({ value, label: value }))
  }, [plans, typeId])

  const scopedPlans = useMemo(() => {
    return plans.filter((plan) => {
      if (typeId && planSubjectBucket(plan.subject) !== typeId) return false
      if (subtypeId && !audienceMatchesSubtype(plan.subject, plan.audience, subtypeId)) return false
      return true
    })
  }, [plans, typeId, subtypeId])

  const statusCounts = useMemo(() => {
    let active = 0
    let inactive = 0
    for (const plan of scopedPlans) {
      if (plan.active) active += 1
      else inactive += 1
    }
    return { all: active + inactive, active, inactive }
  }, [scopedPlans])

  const visible = useMemo(() => {
    const filtered = scopedPlans.filter((plan) => {
      if (status === 'active' && !plan.active) return false
      if (status === 'inactive' && plan.active) return false
      return true
    })
    return [...filtered].sort((a, b) => {
      if (sort === 'newest') return timeMs(b.createdAt) - timeMs(a.createdAt)
      if (sort === 'title') return a.title.localeCompare(b.title)
      if (sort === 'price') return a.price - b.price || a.title.localeCompare(b.title)
      return a.sortOrder - b.sortOrder || a.title.localeCompare(b.title)
    })
  }, [scopedPlans, status, sort])

  return (
    <div className="sf-subscriptions-catalog">
      <CreatePlanCard
        currency={currency}
        defaultGraceHours={defaultGraceHours}
        defaultFormDefinitionId={defaultFormDefinitionId}
        groupOptions={groupOptions}
        locales={locales}
      />

      <section className="outlines-create" aria-label="Filter plans">
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
                All ({plans.length})
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
              <FilterChip pressed={status === 'all'} onClick={() => setStatus('all')}>
                All statuses ({statusCounts.all})
              </FilterChip>
              <FilterChip pressed={status === 'active'} onClick={() => setStatus('active')}>
                Active ({statusCounts.active})
              </FilterChip>
              <FilterChip pressed={status === 'inactive'} onClick={() => setStatus('inactive')}>
                Inactive ({statusCounts.inactive})
              </FilterChip>
            </div>
          </div>
          <label className="settings-field">
            <span>Order</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as PlanSort)} title="Plan order">
              <option value="catalog">Catalog order</option>
              <option value="newest">Newest</option>
              <option value="title">Title</option>
              <option value="price">Price</option>
            </select>
          </label>
        </div>
      </section>

      <section className="outlines-create sf-subscriptions-plans-list" aria-label="Plans">
        <h3>Plans</h3>
        {visible.length === 0 ? (
          <p className="admin-empty">
            No plans{typeId ? ` for ${planSubjectLabel(typeId)}` : ''}.
          </p>
        ) : (
          <div className="sf-subscriptions-plan-list">
            {visible.map((plan) => (
              <PlanRow
                key={plan.id}
                plan={plan}
                currency={currency}
                open={openId === plan.id}
                onToggle={() => setOpenId((current) => (current === plan.id ? null : plan.id))}
                groupOptions={groupOptions}
                locales={locales}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
