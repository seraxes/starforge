'use client'

import React, { useActionState } from 'react'
import Link from 'next/link'

import {
  updateSecurityCaptchaAction,
  type SiteChromeActionState,
} from '@/core/site-chrome/actions'
import { CAPTCHA_PROVIDERS } from '@/core/security/captcha/providers'
import type { CaptchaProviderId } from '@/core/security/captcha/types'

import { useNotifySavedOnOk } from '../../admin-toast'
import { useAutosaveForm } from '../../use-autosave-form'

type Props = {
  captchaEnabled: boolean
  captchaProvider: CaptchaProviderId
  captchaOnRegister: boolean
  captchaOnAuthRecovery: boolean
  /** Legacy unwired provider still stored — shown as a one-time warning. */
  legacyUnwiredProvider?: string | null
}

const initialState: SiteChromeActionState = {}

export function SecuritySettingsForm({
  captchaEnabled,
  captchaProvider,
  captchaOnRegister,
  captchaOnAuthRecovery,
  legacyUnwiredProvider,
}: Props) {
  const [state, formAction, pending] = useActionState(updateSecurityCaptchaAction, initialState)
  useNotifySavedOnOk(state, { toastErrors: true })
  const { formRef, discreteAutosaveProps } = useAutosaveForm()

  return (
    <form ref={formRef} action={formAction} className="settings-form settings-form-wide">
      <div className="admin-settings-mosaic">
      <fieldset className="settings-fieldset">
        <legend>Captcha provider</legend>
        <p className="settings-hint">
          Non-secret enable + provider for Core security surfaces. Turnstile site/secret keys stay
          in env (<code>NEXT_PUBLIC_TURNSTILE_SITE_KEY</code>, <code>TURNSTILE_SECRET_KEY</code>) —
          edit via gated <Link href="/app/admin/site-chrome/environment">Environment</Link>, never
          this form or the database. reCAPTCHA / hCaptcha are not selectable until wired.
        </p>
        {legacyUnwiredProvider ? (
          <p className="admin-inline-error" role="alert">
            Stored provider was <code>{legacyUnwiredProvider}</code> (unwired). Saving will switch
            to the selection below — prefer Turnstile or None.
          </p>
        ) : null}
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
        <legend>Surfaces</legend>
        <p className="settings-hint">
          Which public flows require the selected provider. Forms still opt in per definition
          (“use site captcha default” or a Captcha field). Auth recovery covers forgot password /
          username, magic link, and email OTP request — to limit email-bombing.
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
            <strong>Forms (site default)</strong>
            <span className="settings-flag-desc">
              Form particles that opt in will challenge visitors (Turnstile when selected).
            </span>
          </span>
        </label>
        <label className="settings-flag">
          <input
            type="checkbox"
            name="captchaOnRegister"
            defaultChecked={captchaOnRegister}
            disabled={pending}
            {...discreteAutosaveProps}
          />
          <span>
            <strong>Registration</strong>
            <span className="settings-flag-desc">Require captcha on /register.</span>
          </span>
        </label>
        <label className="settings-flag">
          <input
            type="checkbox"
            name="captchaOnAuthRecovery"
            defaultChecked={captchaOnAuthRecovery}
            disabled={pending}
            {...discreteAutosaveProps}
          />
          <span>
            <strong>Auth recovery</strong>
            <span className="settings-flag-desc">
              Forgot password / username, magic link, and email OTP request.
            </span>
          </span>
        </label>
      </fieldset>

      <fieldset className="settings-fieldset">
        <legend>Form defenses</legend>
        <p className="settings-hint">
          Honeypot enable remains a Security stub. Form rate-limit <em>window / max</em> numbers are
          editable under{' '}
          <Link href="/app/admin/settings/performance">Settings → Performance</Link> (DB). Redis URL
          and trusted proxy hops stay in{' '}
          <Link href="/app/admin/site-chrome/environment">Environment</Link>.
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
              Always on for Forms today — tune window/max under Performance; Redis when{' '}
              <code>REDIS_URL</code> is set.
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
