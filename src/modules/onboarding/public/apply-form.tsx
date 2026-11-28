'use client'

import React, { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { applyOnboardingAction, type OnboardingAdminActionState } from '../actions'

const initial: OnboardingAdminActionState = {}

export function OnboardingApplyForm() {
  const router = useRouter()
  const [state, action, pending] = useActionState(applyOnboardingAction, initial)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  useEffect(() => {
    if (state.ok) {
      setName('')
      setEmail('')
      setPhone('')
      router.refresh()
    }
  }, [state.ok, router])

  return (
    <form action={action}>
      <label className="settings-field">
        <span>Name</span>
        <input
          name="name"
          value={name}
          required
          disabled={pending}
          autoComplete="name"
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="settings-field">
        <span>Email</span>
        <input
          type="email"
          name="email"
          value={email}
          required
          disabled={pending}
          autoComplete="email"
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label className="settings-field">
        <span>Phone</span>
        <input
          type="tel"
          name="phone"
          value={phone}
          disabled={pending}
          autoComplete="tel"
          onChange={(e) => setPhone(e.target.value)}
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
      <div className="page-settings-actions admin-action-row">
        <button type="submit" className="gantry-toolbar-btn gantry-toolbar-btn-save" disabled={pending}>
          {pending ? 'Sending…' : 'Apply'}
        </button>
      </div>
    </form>
  )
}
