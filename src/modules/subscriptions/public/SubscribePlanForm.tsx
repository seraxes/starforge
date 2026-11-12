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
}

export function SubscribePlanForm({ planId, planTitle, priceLabel, methods }: Props) {
  const router = useRouter()
  const [state, action, pending] = useActionState(startSubscribeAction, initial)

  useEffect(() => {
    if (state.redirectTo) {
      router.push(state.redirectTo)
    }
  }, [state.redirectTo, router])

  return (
    <form action={action} className="sf-subscribe-plan-form settings-fieldset">
      <input type="hidden" name="planId" value={planId} />
      <p>
        <strong>{planTitle}</strong> — {priceLabel}
      </p>
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
      </label>
      {state.error ? (
        <p className="admin-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="page-settings-actions">
        <button type="submit" className="gantry-btn gantry-btn-primary" disabled={pending}>
          {pending ? 'Starting…' : 'Subscribe'}
        </button>
      </div>
    </form>
  )
}
