'use client'

import React, { useActionState } from 'react'
import Link from 'next/link'

import {
  updateAuthSettingsAction,
  type SettingsActionState,
} from '@/core/settings/actions'

import { useNotifySavedOnOk } from '../../admin-toast'
import { useAutosaveForm } from '../../use-autosave-form'

export type AuthOptionToggles = {
  forgotPasswordEnabled: boolean
  forgotUsernameEnabled: boolean
  magicLinkEnabled: boolean
  emailOtpEnabled: boolean
  rememberMeEnabled: boolean
  twoFactorEnabled: boolean
  requireEmailVerification: boolean
}

export type AuthSuccessUrls = {
  postLoginUrl: string
  postRegisterUrl: string
  postLogoutUrl: string
}

type Props = {
  registrationEnabled: boolean
  authOptions: AuthOptionToggles
  successUrls: AuthSuccessUrls
}

const initialState: SettingsActionState = {}

export function AuthSettingsForm({ registrationEnabled, authOptions, successUrls }: Props) {
  const [state, formAction, pending] = useActionState(updateAuthSettingsAction, initialState)
  useNotifySavedOnOk(state, { toastErrors: true })
  const { formRef, textAutosaveProps, discreteAutosaveProps } = useAutosaveForm()

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
          <label className="settings-flag">
            <input
              type="checkbox"
              name="authRequireEmailVerification"
              defaultChecked={authOptions.requireEmailVerification}
              disabled={pending}
              {...discreteAutosaveProps}
            />
            <span>
              <strong>Require email verification</strong>
              <span className="settings-flag-desc">
                New accounts get a verification link (Mailer). Sign-in waits until the link is used.
                Off by default.
              </span>
            </span>
          </label>
        </fieldset>

        <fieldset className="settings-fieldset">
          <legend>Sign-in helpers</legend>
          <p className="settings-hint">
            Show or hide public recovery links on login / welcome. Routes stay reachable by URL
            when off; helpers and showcase CTAs hide. Mail delivery: Chrome → Outbound email +
            Environment secrets.
          </p>
          <label className="settings-flag">
            <input
              type="checkbox"
              name="authForgotPasswordEnabled"
              defaultChecked={authOptions.forgotPasswordEnabled}
              disabled={pending}
              {...discreteAutosaveProps}
            />
            <span>
              <strong>Forgot password</strong>
              <span className="settings-flag-desc">
                Link to <code>/forgot-password</code>.
              </span>
            </span>
          </label>
          <label className="settings-flag">
            <input
              type="checkbox"
              name="authForgotUsernameEnabled"
              defaultChecked={authOptions.forgotUsernameEnabled}
              disabled={pending}
              {...discreteAutosaveProps}
            />
            <span>
              <strong>Forgot login email</strong>
              <span className="settings-flag-desc">
                Link to <code>/forgot-username</code>.
              </span>
            </span>
          </label>
        </fieldset>

        <fieldset className="settings-fieldset">
          <legend>Passwordless</legend>
          <p className="settings-hint">
            Magic link and email OTP tabs on <code>/login</code> (Better Auth + Mailer). When
            both are off, guests sign in with password only.
          </p>
          <label className="settings-flag">
            <input
              type="checkbox"
              name="authMagicLinkEnabled"
              defaultChecked={authOptions.magicLinkEnabled}
              disabled={pending}
              {...discreteAutosaveProps}
            />
            <span>
              <strong>Magic link</strong>
              <span className="settings-flag-desc">One-time email sign-in link.</span>
            </span>
          </label>
          <label className="settings-flag">
            <input
              type="checkbox"
              name="authEmailOtpEnabled"
              defaultChecked={authOptions.emailOtpEnabled}
              disabled={pending}
              {...discreteAutosaveProps}
            />
            <span>
              <strong>Email code (OTP)</strong>
              <span className="settings-flag-desc">One-time code via email.</span>
            </span>
          </label>
        </fieldset>

        <fieldset className="settings-fieldset">
          <legend>Stay signed in &amp; 2FA</legend>
          <p className="settings-hint">
            Remember-me checkbox on password / OTP sign-in, and Account security (TOTP) CTAs.
            Existing 2FA enrollments keep working when the CTA is hidden.
          </p>
          <label className="settings-flag">
            <input
              type="checkbox"
              name="authRememberMeEnabled"
              defaultChecked={authOptions.rememberMeEnabled}
              disabled={pending}
              {...discreteAutosaveProps}
            />
            <span>
              <strong>Stay signed in</strong>
              <span className="settings-flag-desc">
                Remember-me checkbox on password and email-code forms.
              </span>
            </span>
          </label>
          <label className="settings-flag">
            <input
              type="checkbox"
              name="authTwoFactorEnabled"
              defaultChecked={authOptions.twoFactorEnabled}
              disabled={pending}
              {...discreteAutosaveProps}
            />
            <span>
              <strong>2FA setup links</strong>
              <span className="settings-flag-desc">
                Account security / authenticator CTAs on login and welcome.
              </span>
            </span>
          </label>
        </fieldset>

        <fieldset className="settings-fieldset">
          <legend>After sign-in / sign-out</legend>
          <p className="settings-hint">
            Site-relative paths only (start with <code>/</code>). Login deep links via{' '}
            <code>?next=</code> still override the post-login default. When the site is offline,
            a gated logout target falls back to <code>/login</code>.
          </p>
          <label className="settings-field">
            <span>After login</span>
            <input
              type="text"
              name="authPostLoginUrl"
              defaultValue={successUrls.postLoginUrl}
              placeholder="/"
              autoComplete="off"
              disabled={pending}
              {...textAutosaveProps}
            />
          </label>
          <label className="settings-field">
            <span>After register</span>
            <input
              type="text"
              name="authPostRegisterUrl"
              defaultValue={successUrls.postRegisterUrl}
              placeholder="/"
              autoComplete="off"
              disabled={pending}
              {...textAutosaveProps}
            />
          </label>
          <label className="settings-field">
            <span>After logout</span>
            <input
              type="text"
              name="authPostLogoutUrl"
              defaultValue={successUrls.postLogoutUrl}
              placeholder="/login"
              autoComplete="off"
              disabled={pending}
              {...textAutosaveProps}
            />
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
