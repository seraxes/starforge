'use client'

import React, { useActionState } from 'react'

import { loginAction, type AuthActionState } from '@/core/auth/actions'

const initialState: AuthActionState = {}

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState)

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
