'use client'

import React, { useActionState } from 'react'

import { registerAction, type AuthActionState } from '@/core/auth/actions'

const initialState: AuthActionState = {}

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerAction, initialState)

  return (
    <form className="auth-form" action={formAction} noValidate>
      <label>
        Name
        <input
          name="name"
          type="text"
          autoComplete="name"
          required
          disabled={pending}
          defaultValue={state.name ?? ''}
          key={`name-${state.name ?? ''}-${state.error ?? 'ok'}`}
        />
      </label>
      <label>
        Email
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={pending}
          defaultValue={state.email ?? ''}
          key={`email-${state.email ?? ''}-${state.error ?? 'ok'}`}
        />
      </label>
      <label>
        Password
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          disabled={pending}
        />
      </label>
      {state.error ? (
        <p className="auth-error" role="alert">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className="primary" disabled={pending}>
        {pending ? 'Creating account…' : 'Create account'}
      </button>
    </form>
  )
}
