'use client'

import React, { useActionState } from 'react'
import Link from 'next/link'

import {
  updateCaptchaIntegrationAction,
  type SiteChromeActionState,
} from '@/core/site-chrome/actions'
import { CAPTCHA_PROVIDERS } from '@/core/site-chrome/defaults'
import type { CaptchaProvider } from '@/core/site-chrome/types'

import { useNotifySavedOnOk } from '../../admin-toast'
import { useAutosaveForm } from '../../use-autosave-form'

type Props = {
  captchaEnabled: boolean
  captchaProvider: CaptchaProvider
}

const initialState: SiteChromeActionState = {}

export function IntegrationsForm({ captchaEnabled, captchaProvider }: Props) {
  const [state, formAction, pending] = useActionState(updateCaptchaIntegrationAction, initialState)
  useNotifySavedOnOk(state, { toastErrors: true })
  const { formRef, discreteAutosaveProps } = useAutosaveForm()

  return (
    <form ref={formRef} action={formAction} className="settings-form settings-form-wide">
      <fieldset className="settings-fieldset">
        <legend>Default sitewide captcha</legend>
        <p className="settings-hint">
          Provider/enable defaults for the Core Form module when a form opts into “use site captcha
          default”. Turnstile site/secret keys stay in env (
          <code>NEXT_PUBLIC_TURNSTILE_SITE_KEY</code>, <code>TURNSTILE_SECRET_KEY</code>) — edit via
          gated <Link href="/app/admin/site-chrome/environment">Environment</Link>, never this form
          or the database. reCAPTCHA / hCaptcha remain unwired.
        </p>
        <label className="settings-flag">
          <input
            type="checkbox"
            name="captchaEnabled"
            defaultChecked={captchaEnabled}
            disabled={pending}
            {...discreteAutosaveProps}
          />
          <span>
            <strong>Enable captcha by default</strong>
            <span className="settings-flag-desc">
              Form particles that opt in will challenge visitors (Turnstile when selected).
            </span>
          </span>
        </label>
        <label className="settings-field">
          <span>Provider</span>
          <select
            name="captchaProvider"
            defaultValue={captchaProvider}
            disabled={pending}
            {...discreteAutosaveProps}
          >
            {CAPTCHA_PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
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
