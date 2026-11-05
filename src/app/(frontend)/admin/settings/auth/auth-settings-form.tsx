'use client'

import React, { useActionState } from 'react'
import Link from 'next/link'

import {
  updateAuthSettingsAction,
  type SettingsActionState,
} from '@/core/settings/actions'

import { useNotifySavedOnOk } from '../../admin-toast'
import { useAutosaveForm } from '../../use-autosave-form'

type Props = {
  registrationEnabled: boolean
}

const initialState: SettingsActionState = {}

export function AuthSettingsForm({ registrationEnabled }: Props) {
  const [state, formAction, pending] = useActionState(updateAuthSettingsAction, initialState)
  useNotifySavedOnOk(state, { toastErrors: true })
  const { formRef, discreteAutosaveProps } = useAutosaveForm()

  return (
    <form ref={formRef} action={formAction} className="settings-form settings-form-wide">
      <div className="admin-settings-mosaic">
      <fieldset className="settings-fieldset">
        <legend>Registration</legend>
        <p className="settings-hint">
          When off, <code>/register</code> rejects signups and public create-account links hide.
          Existing accounts still sign in at <Link href="/login">/login</Link>.
        </p>
        <label className="settings-flag">
          <input
            type="checkbox"
            name="registrationEnabled"
            defaultChecked={registrationEnabled}
            disabled={pending}
            {...discreteAutosaveProps}
          />
          <span>
            <strong>Allow new account registration</strong>
            <span className="settings-flag-desc">
              Product module <code>product:registration</code> — also listed under Modules.
            </span>
          </span>
        </label>
      </fieldset>

      <fieldset className="settings-fieldset">
        <legend>Passwordless &amp; 2FA</legend>
        <p className="settings-hint">
          Magic link, email OTP, and TOTP 2FA ship with Better Auth. Users manage authenticator
          apps under account security; site-wide policy toggles for those helpers can land here
          later. Mail delivery: Chrome → Outbound email + Environment secrets.
        </p>
      </fieldset>
      </div>

      {state.error ? (
        <p className="admin-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
      {pending ? <p className="field-hint">Saving…</p> : null}
    </form>
  )
}
