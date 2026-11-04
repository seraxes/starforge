'use client'

import React, { useActionState } from 'react'
import Link from 'next/link'

import {
  updatePerformanceSettingsAction,
  type SettingsActionState,
} from '@/core/settings/actions'
import {
  FORM_RATE_LIMIT_MAX_MAX,
  FORM_RATE_LIMIT_MAX_MIN,
  FORM_RATE_LIMIT_WINDOW_SEC_MAX,
  FORM_RATE_LIMIT_WINDOW_SEC_MIN,
} from '@/core/settings/defaults'

import { useNotifySavedOnOk } from '../../admin-toast'
import { useAutosaveForm } from '../../use-autosave-form'

type Props = {
  formRateLimitMax: number
  formRateLimitWindowSec: number
}

const initialState: SettingsActionState = {}

export function PerformanceSettingsForm({
  formRateLimitMax,
  formRateLimitWindowSec,
}: Props) {
  const [state, formAction, pending] = useActionState(
    updatePerformanceSettingsAction,
    initialState,
  )
  useNotifySavedOnOk(state, { toastErrors: true })
  const { formRef, textAutosaveProps } = useAutosaveForm()

  return (
    <form ref={formRef} action={formAction} className="settings-form settings-form-wide">
      <div className="admin-settings-mosaic">
        <fieldset className="settings-fieldset settings-fieldset-wide">
          <legend>Form submission rate limit</legend>
          <p className="settings-hint">
            Per visitor IP + form key. Uses the shared RateLimiter (memory locally; Redis when{' '}
            <code>REDIS_URL</code> is set). Numbers live in Site Settings — secrets and infra URLs
            stay in gated{' '}
            <Link href="/app/admin/site-chrome/environment">Chrome → Environment</Link>.
          </p>
          <label className="settings-field">
            <span>Max submissions per window</span>
            <input
              type="number"
              name="formRateLimitMax"
              defaultValue={formRateLimitMax}
              min={FORM_RATE_LIMIT_MAX_MIN}
              max={FORM_RATE_LIMIT_MAX_MAX}
              step={1}
              disabled={pending}
              {...textAutosaveProps}
            />
          </label>
          <label className="settings-field">
            <span>Window (seconds)</span>
            <input
              type="number"
              name="formRateLimitWindowSec"
              defaultValue={formRateLimitWindowSec}
              min={FORM_RATE_LIMIT_WINDOW_SEC_MIN}
              max={FORM_RATE_LIMIT_WINDOW_SEC_MAX}
              step={1}
              disabled={pending}
              {...textAutosaveProps}
            />
          </label>
        </fieldset>

        <fieldset className="settings-fieldset settings-fieldset-wide">
          <legend>Published content cache</legend>
          <p className="settings-hint">
            Backend selection (<code>STARFORGE_CONTENT_CACHE</code>) and <code>REDIS_URL</code> are
            infra — edit under{' '}
            <Link href="/app/admin/site-chrome/environment">Environment</Link>, not here. Autosave
            debounce stays under{' '}
            <Link href="/app/admin/settings/admin-ux">Admin UX</Link>.
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
