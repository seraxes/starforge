'use client'

import React, { useActionState, useState } from 'react'

import { verifyTwoFactorAction, type AuthActionState } from '@/core/auth/actions'

const initialState: AuthActionState = { twoFactorRequired: true }

export function TwoFactorForm({ next }: { next?: string }) {
  const [mode, setMode] = useState<'totp' | 'backup'>('totp')
  const [state, formAction, pending] = useActionState(verifyTwoFactorAction, {
    ...initialState,
    next,
  })

  return (
    <form className="auth-form" action={formAction} noValidate>
      {next || state.next ? <input type="hidden" name="next" value={state.next ?? next} /> : null}
      <input type="hidden" name="mode" value={mode} />

      <div className="auth-mode-tabs" role="tablist" aria-label="2FA method">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'totp'}
          className={mode === 'totp' ? 'auth-mode-tab is-active' : 'auth-mode-tab'}
          onClick={() => setMode('totp')}
        >
          Authenticator
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'backup'}
          className={mode === 'backup' ? 'auth-mode-tab is-active' : 'auth-mode-tab'}
          onClick={() => setMode('backup')}
        >
          Recovery code
        </button>
      </div>

      <label>
        {mode === 'totp' ? '6-digit code' : 'Recovery code'}
        <input
          name="code"
          type="text"
          autoComplete="one-time-code"
          inputMode={mode === 'totp' ? 'numeric' : 'text'}
          required
          disabled={pending}
          key={`code-${mode}`}
        />
      </label>
      <label className="auth-check">
        <input name="trustDevice" type="checkbox" value="true" disabled={pending} />
        <span>Trust this device for 30 days</span>
      </label>
      {state.error ? (
        <p className="auth-error" role="alert">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className="primary" disabled={pending}>
        {pending ? 'Verifying…' : 'Verify & continue'}
      </button>
    </form>
  )
}
