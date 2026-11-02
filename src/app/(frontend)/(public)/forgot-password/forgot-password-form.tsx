'use client'

import React, { useActionState } from 'react'

import { requestPasswordResetAction, type AuthActionState } from '@/core/auth/actions'

const initialState: AuthActionState = {}

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, initialState)

  return (
    <form className="auth-form" action={formAction} noValidate>
      <label>
        Email
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={pending}
          defaultValue={state.email ?? ''}
          key={`email-${state.email ?? ''}-${state.success ?? state.error ?? 'ok'}`}
        />
      </label>
      {state.error ? (
        <p className="auth-error" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="auth-success" role="status">
          {state.success}
        </p>
      ) : null}
      <button type="submit" className="primary" disabled={pending}>
        {pending ? 'Sending…' : 'Email reset link'}
      </button>
    </form>
  )
}
