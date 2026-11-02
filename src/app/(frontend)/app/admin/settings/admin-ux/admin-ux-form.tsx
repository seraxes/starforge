'use client'

import React, { useActionState } from 'react'

import {
  updateAdminUxSettingsAction,
  type SettingsActionState,
} from '@/core/settings/actions'
import {
  ADMIN_AUTOSAVE_DEBOUNCE_MAX_MS,
  ADMIN_AUTOSAVE_DEBOUNCE_MIN_MS,
} from '@/core/settings/defaults'

import { useNotifySavedOnOk } from '../../admin-toast'
import { useAutosaveForm } from '../../use-autosave-form'

type Props = {
  adminAutosaveDebounceMs: number
}

const initialState: SettingsActionState = {}

export function AdminUxForm({ adminAutosaveDebounceMs }: Props) {
  const [state, formAction, pending] = useActionState(updateAdminUxSettingsAction, initialState)
  useNotifySavedOnOk(state, { toastErrors: true })
  const { formRef, textAutosaveProps } = useAutosaveForm()

  return (
    <form ref={formRef} action={formAction} className="settings-form settings-form-wide">
      <fieldset className="settings-fieldset">
        <legend>Admin autosave</legend>
        <p className="settings-hint">
          Delay before Core admin text fields patch after typing. Blur still saves immediately.
          Applies to particle cogs, Styles, Chrome, Forms, and other autosave forms.
        </p>
        <label className="settings-field">
          <span>Autosave debounce (ms)</span>
          <input
            type="number"
            name="adminAutosaveDebounceMs"
            defaultValue={adminAutosaveDebounceMs}
            min={ADMIN_AUTOSAVE_DEBOUNCE_MIN_MS}
            max={ADMIN_AUTOSAVE_DEBOUNCE_MAX_MS}
            step={50}
            disabled={pending}
            {...textAutosaveProps}
          />
        </label>
      </fieldset>

      {state.error ? (
        <p className="admin-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
      {pending ? <p className="field-hint">Saving…</p> : null}
    </form>
  )
}
