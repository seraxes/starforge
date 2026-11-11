'use client'

import React, { useActionState } from 'react'
import Link from 'next/link'

import {
  saveFormsModuleSettingsAction,
  type FormAdminActionState,
} from '@/modules/forms/actions'
import type { FormsModuleSettings } from '@/modules/forms/types'
import type { MailerInfo } from '@/core/mail/types'

import { useNotifySavedOnOk } from '../../admin-toast'
import { useAutosaveForm } from '../../use-autosave-form'

const initial: FormAdminActionState = {}

export function FormsSettingsForm({
  initial: settings,
  mailer,
}: {
  initial: FormsModuleSettings
  mailer: MailerInfo
}) {
  const [state, formAction, pending] = useActionState(saveFormsModuleSettingsAction, initial)
  useNotifySavedOnOk(state)
  const { formRef, saveDebounced, flushOnBlur } = useAutosaveForm()

  const transportLabel = !mailer.enabled
    ? 'Disabled (Chrome)'
    : `${mailer.label}${mailer.ready ? '' : ' — not ready'}`

  return (
    <form ref={formRef} action={formAction} className="settings-form settings-form-wide sf-forms-settings-form">
      <div className="admin-settings-mosaic">
        <fieldset className="settings-fieldset">
          <legend>Notify defaults</legend>
          <label className="settings-field">
            <span>Default admin emails</span>
            <input
              type="text"
              name="defaultAdminEmails"
              defaultValue={settings.defaultAdminEmails.join(', ')}
              placeholder="admin@example.com, ops@example.com"
              onChange={() => saveDebounced()}
              onBlur={flushOnBlur}
            />
            <span className="settings-flag-desc">
              Used when a form enables “Notify admin” without overrides.
            </span>
          </label>
          <label className="settings-field">
            <span>From address</span>
            <input
              type="email"
              name="fromAddress"
              defaultValue={settings.fromAddress}
              placeholder="forms@example.com"
              onChange={() => saveDebounced()}
              onBlur={flushOnBlur}
            />
            <span className="settings-flag-desc">
              Overrides Chrome default From when set. Empty → Chrome /{' '}
              <code>STARFORGE_MAIL_FROM</code>.
            </span>
          </label>
        </fieldset>
        <fieldset className="settings-fieldset">
          <legend>Form defaults</legend>
          <label className="settings-field">
            <span>Default success message</span>
            <input
              type="text"
              name="defaultSuccessMessage"
              defaultValue={settings.defaultSuccessMessage}
              onChange={() => saveDebounced()}
              onBlur={flushOnBlur}
            />
            <span className="settings-flag-desc">
              Seeded into new form definitions (per-form editable).
            </span>
          </label>
          <label className="settings-field">
            <span>Email transport</span>
            <input type="text" value={transportLabel} disabled readOnly />
            <span className="settings-flag-desc">
              Platform Mailer — configure enable / provider / From under{' '}
              <Link href="/admin/site-chrome">Chrome</Link>
              {mailer.detail ? `. ${mailer.detail}` : '.'} Secrets stay in env.
            </span>
          </label>
        </fieldset>
      </div>
      {pending ? <p className="field-hint">Saving…</p> : null}
      {state.error ? (
        <p className="admin-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}
