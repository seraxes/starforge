'use client'

import React, { useActionState } from 'react'
import Link from 'next/link'

import { registerAction, type AuthActionState } from '@/core/auth/actions'
import { AuthCaptchaFields } from '@/core/security/captcha/AuthCaptchaFields'
import type { ResolvedCaptcha } from '@/core/security/captcha/types'

const initialState: AuthActionState = {}

export function RegisterForm({
  captcha,
  requireEmailVerification = false,
}: {
  captcha: ResolvedCaptcha
  requireEmailVerification?: boolean
}) {
  const [state, formAction, pending] = useActionState(registerAction, initialState)

  if (state.success) {
    return (
      <div className="auth-form">
        <p className="auth-success" role="status">
          {state.success}
        </p>
        <p className="auth-helpers">
          <Link href="/login">Back to sign in</Link>
        </p>
      </div>
    )
  }

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
      <p className="auth-hint">
        {requireEmailVerification
          ? 'This email is your sign-in ID. After you create the account, open the verification link we send before signing in.'
          : 'This email is your sign-in ID (not the display name). You can add authenticator 2FA later under Account security.'}
      </p>
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
      <AuthCaptchaFields captcha={captcha} />
      {state.error ? (
        <p className="auth-error" role="alert">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className="primary" disabled={pending}>
        {pending ? 'Creating account…' : 'Create account'}
      </button>
      <p className="auth-helpers">
        <Link href="/login">Already have an account?</Link>
        {' · '}
        <Link href="/forgot-password">Forgot password?</Link>
      </p>
    </form>
  )
}
