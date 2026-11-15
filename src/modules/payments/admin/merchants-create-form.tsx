'use client'

import React, { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'

import { createAdminMerchantAction, type PaymentsActionState } from '../actions'

const initial: PaymentsActionState = {}

export function MerchantsCreateForm() {
  const router = useRouter()
  const [state, action, pending] = useActionState(createAdminMerchantAction, initial)

  useNotifySavedOnOk(state)
  useEffect(() => {
    if (state.ok) router.refresh()
  }, [state, router])

  return (
    <form action={action}>
      <div className="page-settings-panel">
        <header className="page-settings-panel-head">
          <h3>Add merchant</h3>
        </header>
        <div className="page-settings-panel-body">
          <p className="settings-hint">
            Looks up an existing account by email and opens a merchant profile for them. Payments
            admin can set keys and offer switches anytime. While Subscriptions is off, this also
            grants the collect stub. When Subscriptions is on, the seller still needs the collect
            entitlement (subscription) before self-service collect and live checkout as that seller.
          </p>
          <label className="settings-field">
            <span>Account email</span>
            <input
              type="email"
              name="email"
              required
              disabled={pending}
              autoComplete="off"
              placeholder="seller@example.com"
            />
          </label>
          {state.error ? (
            <p className="admin-inline-error" role="alert">
              {state.error}
            </p>
          ) : null}
          {state.ok && state.message ? (
            <p className="admin-inline-ok" role="status">
              {state.message}
            </p>
          ) : null}
          <div className="page-settings-actions">
            <button
              type="submit"
              className="gantry-toolbar-btn gantry-toolbar-btn-save"
              disabled={pending}
            >
              {pending ? 'Adding…' : 'Add merchant'}
            </button>
          </div>
        </div>
      </div>
    </form>
  )
}
