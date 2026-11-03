'use client'

import React, { useActionState } from 'react'
import Link from 'next/link'

import {
  updateSecurityCaptchaAction,
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

export function SecuritySettingsForm({ captchaEnabled, captchaProvider }: Props) {
  const [state, formAction, pending] = useActionState(updateSecurityCaptchaAction, initialState)
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

      <fieldset className="settings-fieldset">
        <legend>Form defenses</legend>
        <p className="settings-hint">
          Sitewide honeypot and rate-limit policy will land here. Forms already apply a hidden
          honeypot field and an in-memory per-form bucket today; these toggles are stubs until a
          shared Security store/Redis-backed limiter ships.
        </p>
        <label className="settings-flag">
          <input type="checkbox" name="honeypotEnabledStub" disabled defaultChecked />
          <span>
            <strong>Honeypot field</strong>
            <span className="settings-flag-desc">Coming soon — Forms already use a honeypot.</span>
          </span>
        </label>
        <label className="settings-flag">
          <input type="checkbox" name="rateLimitEnabledStub" disabled defaultChecked />
          <span>
            <strong>Submission rate limit</strong>
            <span className="settings-flag-desc">
              Coming soon — in-memory Form buckets now; Redis later.
            </span>
          </span>
        </label>
      </fieldset>

      <fieldset className="settings-fieldset">
        <legend>HTTP security headers</legend>
        <p className="settings-hint">
          Baseline headers ship from Next <code>headers()</code> + middleware (CSP for Next/Payload
          + Turnstile, <code>X-Frame-Options</code>, <code>Referrer-Policy</code>,{' '}
          <code>X-Content-Type-Options</code>, <code>Permissions-Policy</code>). HSTS is sent only
          on the Secure-cookie path (HTTPS app URL or <code>STARFORGE_SECURE_COOKIES=1</code>). No
          Site Settings toggle — secrets and prod URL stay in env / Environment, never the database.
        </p>
        <label className="settings-flag">
          <input type="checkbox" name="securityHeadersEnabledStub" disabled defaultChecked />
          <span>
            <strong>Security headers (always on)</strong>
            <span className="settings-flag-desc">
              Env-driven — see <code>STARFORGE_SECURE_COOKIES</code> and HTTPS{' '}
              <code>BETTER_AUTH_URL</code> / <code>NEXT_PUBLIC_APP_URL</code>.
            </span>
          </span>
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
