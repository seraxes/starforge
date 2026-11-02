'use client'

import React, { useActionState } from 'react'

import { resetPasswordAction, type AuthActionState } from '@/core/auth/actions'

const initialState: AuthActionState = {}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, initialState)

  return (
    <form className="auth-form" action={formAction} noValidate>
      <input type="hidden" name="token" value={token} />
      <label>
        New password
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          disabled={pending}
        />
      </label>
      <label>
        Confirm password
        <input
          name="confirmPassword"
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
        {pending ? 'Saving…' : 'Save new password'}
      </button>
    </form>
  )
}
