'use client'

import React, { useActionState } from 'react'
import Link from 'next/link'

import {
  saveFormsModuleSettingsAction,
  type FormAdminActionState,
} from '@/core/forms/actions'
import type { FormsModuleSettings } from '@/core/forms/types'
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
    ? 'Disabled (Site Chrome)'
    : `${mailer.label}${mailer.ready ? '' : ' — not ready'}`

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
          onBlur={flushOnBlur}
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
          onBlur={flushOnBlur}
        />
        <span className="layout-muted">
          Overrides Site Chrome default From when set. Empty → Chrome /{' '}
          <code>STARFORGE_MAIL_FROM</code>.
        </span>
      </label>
      <label>
        <span>Default success message</span>
        <input
          type="text"
          name="defaultSuccessMessage"
          defaultValue={settings.defaultSuccessMessage}
          onChange={() => saveDebounced()}
          onBlur={flushOnBlur}
        />
        <span className="layout-muted">Seeded into new form definitions (per-form editable).</span>
      </label>
      <label>
        <span>Email transport</span>
        <input type="text" value={transportLabel} disabled readOnly />
        <span className="layout-muted">
          Platform Mailer — configure enable / provider / From under{' '}
          <Link href="/app/admin/site-chrome">Site Chrome</Link>
          {mailer.detail ? `. ${mailer.detail}` : '.'} Secrets stay in env.
        </span>
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
