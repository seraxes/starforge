'use client'

import React, { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { startSubscribeAction, type SubscriptionsActionState } from '../actions'

const initial: SubscriptionsActionState = {}

type Props = {
  planId: string
  planTitle: string
  priceLabel: string
  methods: string[]
  mode?: 'subscribe' | 'renew' | 'upgrade'
  fromPeriodId?: string
  recurringSupported?: boolean
  isFree?: boolean
  submitLabel?: string
}

export function SubscribePlanForm({
  planId,
  planTitle,
  priceLabel,
  methods,
  mode = 'subscribe',
  fromPeriodId,
  recurringSupported = false,
  isFree = false,
  submitLabel,
}: Props) {
  const router = useRouter()
  const [state, action, pending] = useActionState(startSubscribeAction, initial)

  useEffect(() => {
    if (state.redirectTo) {
      router.push(state.redirectTo)
    } else if (state.ok && state.periodId) {
      router.refresh()
    }
  }, [state.redirectTo, state.ok, state.periodId, router])

  const label =
    submitLabel ||
    (mode === 'renew' ? 'Renew' : mode === 'upgrade' ? 'Upgrade' : isFree ? 'Activate' : 'Subscribe')

  return (
    <form action={action} className="sf-subscribe-plan-form settings-fieldset">
      <input type="hidden" name="planId" value={planId} />
      <input type="hidden" name="mode" value={mode} />
      {fromPeriodId ? <input type="hidden" name="fromPeriodId" value={fromPeriodId} /> : null}
      <p>
        <strong>{planTitle}</strong> — {priceLabel}
      </p>
      {!isFree ? (
        <>
          <label className="settings-field">
            <span>Payment method</span>
            <select name="method" defaultValue={methods[0] || 'bank_transfer'} disabled={pending}>
              {methods.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="settings-field">
            <span>Coupon (optional)</span>
            <input type="text" name="couponCode" disabled={pending} autoComplete="off" />
            <span className="settings-hint">Codes are managed under Payments → Coupons.</span>
          </label>
          {recurringSupported ? (
            <label className="settings-field settings-flag">
              <span>Auto-renew</span>
              <input type="checkbox" name="autoRenew" value="1" disabled={pending} />
            </label>
          ) : null}
        </>
      ) : (
        <input type="hidden" name="method" value="bank_transfer" />
      )}
      {state.error ? (
        <p className="admin-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok && state.periodId ? (
        <p className="admin-inline-ok" role="status">
          Activated.
        </p>
      ) : null}
      <div className="page-settings-actions">
        <button type="submit" className="gantry-btn gantry-btn-primary" disabled={pending}>
          {pending ? 'Working…' : label}
        </button>
      </div>
    </form>
  )
}
