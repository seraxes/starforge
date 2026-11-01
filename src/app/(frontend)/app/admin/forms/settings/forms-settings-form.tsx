'use client'

import React, { useActionState } from 'react'

import {
  saveFormsModuleSettingsAction,
  type FormAdminActionState,
} from '@/core/forms/actions'
import type { FormsModuleSettings } from '@/core/forms/types'

import { useNotifySavedOnOk } from '../../admin-toast'
import { useAutosaveForm } from '../../use-autosave-form'

const initial: FormAdminActionState = {}

export function FormsSettingsForm({ initial: settings }: { initial: FormsModuleSettings }) {
  const [state, formAction, pending] = useActionState(saveFormsModuleSettingsAction, initial)
  useNotifySavedOnOk(state)
  const { formRef, saveDebounced, saveNow } = useAutosaveForm()

  return (
    <form ref={formRef} action={formAction} className="gantry-typed-form sf-forms-settings-form">
      <label>
        <span>Default admin emails</span>
        <input
          type="text"
          name="defaultAdminEmails"
          defaultValue={settings.defaultAdminEmails.join(', ')}
          placeholder="admin@example.com, ops@example.com"
          onChange={() => saveDebounced()}
          onBlur={saveNow}
        />
        <span className="layout-muted">Used when a form enables “Notify admin” without overrides.</span>
      </label>
      <label>
        <span>From address</span>
        <input
          type="email"
          name="fromAddress"
          defaultValue={settings.fromAddress}
          placeholder="forms@example.com"
          onChange={() => saveDebounced()}
          onBlur={saveNow}
        />
        <span className="layout-muted">Stored for when transport ships; unused by stub.</span>
      </label>
      <label>
        <span>Default success message</span>
        <input
          type="text"
          name="defaultSuccessMessage"
          defaultValue={settings.defaultSuccessMessage}
          onChange={() => saveDebounced()}
          onBlur={saveNow}
        />
        <span className="layout-muted">Seeded into new form definitions (per-form editable).</span>
      </label>
      <label>
        <span>Email transport</span>
        <input type="text" value="stub (not sending yet)" disabled readOnly />
      </label>
      {pending ? <p className="layout-muted">Saving…</p> : null}
      {state.error ? (
        <p className="admin-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}
