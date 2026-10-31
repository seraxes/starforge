'use client'

import React, { useActionState } from 'react'

import { loginAction, type AuthActionState } from '@/core/auth/actions'

const initialState: AuthActionState = {}

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, {
    ...initialState,
    next,
  })

  return (
    <form className="auth-form" action={formAction} noValidate>
      {next || state.next ? <input type="hidden" name="next" value={state.next ?? next} /> : null}
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
          autoComplete="current-password"
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
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
