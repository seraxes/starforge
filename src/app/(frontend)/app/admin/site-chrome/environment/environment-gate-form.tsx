'use client'

import React, { useActionState } from 'react'

import {
  unlockEnvEditorAction,
  type EnvEditorGateActionState,
} from '@/core/env-editor/actions'

const initial: EnvEditorGateActionState = {}

export function EnvironmentGateForm({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState(unlockEnvEditorAction, initial)

  return (
    <form action={formAction} className="settings-form settings-form-wide">
      <div className="admin-settings-mosaic">
      <fieldset className="settings-fieldset settings-fieldset-wide">
        <legend>Confirm password</legend>
        <p className="settings-hint">
          Environment editing is developer-admin only and requires re-entering the password for{' '}
          <strong>{email}</strong>. Secrets stay in <code>.env.local</code> — never Chrome or
          the database.
        </p>
        <label className="settings-field">
          <span>Current password</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            minLength={8}
            disabled={pending}
          />
        </label>
      </fieldset>
      </div>
      {state.error ? (
        <p className="admin-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
      <p>
        <button type="submit" className="primary" disabled={pending}>
          {pending ? 'Unlocking…' : 'Unlock Environment'}
        </button>
      </p>
    </form>
  )
}
