'use client'

import React, { useActionState, useState } from 'react'
import Link from 'next/link'

import {
  loginAction,
  magicLinkAction,
  requestEmailOtpAction,
  verifyEmailOtpAction,
  type AuthActionState,
} from '@/core/auth/actions'
import { AuthCaptchaFields } from '@/core/security/captcha/AuthCaptchaFields'
import type { ResolvedCaptcha } from '@/core/security/captcha/types'

import { type LoginMode, parseLoginMode } from './login-mode'

export type { LoginMode }
export { parseLoginMode }

const initialState: AuthActionState = {}

async function otpFormAction(
  prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const intent = String(formData.get('intent') ?? 'request')
  if (intent === 'verify') {
    return verifyEmailOtpAction(prev, formData)
  }
  return requestEmailOtpAction(prev, formData)
}

const IDLE_CAPTCHA: ResolvedCaptcha = {
  required: false,
  provider: 'none',
  siteKey: null,
}

export function LoginForm({
  next,
  resetSuccess,
  magicError,
  initialMode = 'password',
  showHelperLinks = true,
  captcha = IDLE_CAPTCHA,
}: {
  next?: string
  resetSuccess?: boolean
  magicError?: boolean
  /** Deep-link from welcome/home CTAs (`?mode=magic|otp|password`). */
  initialMode?: LoginMode
  /** When false, omit forgot-password helpers (parent panel already lists them). */
  showHelperLinks?: boolean
  /** Auth-recovery captcha (magic link / email OTP request). */
  captcha?: ResolvedCaptcha
}) {
  const [mode, setMode] = useState<LoginMode>(initialMode)
  const [passwordState, passwordAction, passwordPending] = useActionState(loginAction, {
    ...initialState,
    next,
  })
  const [magicState, magicAction, magicPending] = useActionState(magicLinkAction, {
    ...initialState,
    next,
  })
  const [otpState, otpAction, otpPending] = useActionState(otpFormAction, {
    ...initialState,
    next,
  })

  return (
    <div className="auth-login">
      {resetSuccess ? (
        <p className="auth-success" role="status">
          Password updated. Sign in with your email and new password.
        </p>
      ) : null}
      {magicError ? (
        <p className="auth-error" role="alert">
          That magic link was invalid or expired. Request a new one below.
        </p>
      ) : null}

      <div className="auth-mode-tabs" role="tablist" aria-label="Sign-in method">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'password'}
          className={mode === 'password' ? 'auth-mode-tab is-active' : 'auth-mode-tab'}
          onClick={() => setMode('password')}
        >
          Password
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'magic'}
          className={mode === 'magic' ? 'auth-mode-tab is-active' : 'auth-mode-tab'}
          onClick={() => setMode('magic')}
        >
          Magic link
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'otp'}
          className={mode === 'otp' ? 'auth-mode-tab is-active' : 'auth-mode-tab'}
          onClick={() => setMode('otp')}
        >
          Email code
        </button>
      </div>

      {mode === 'password' ? (
        <form className="auth-form" action={passwordAction} noValidate>
          {next || passwordState.next ? (
            <input type="hidden" name="next" value={passwordState.next ?? next} />
          ) : null}
          <label>
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              disabled={passwordPending}
              defaultValue={passwordState.email ?? ''}
              key={`pw-email-${passwordState.email ?? ''}-${passwordState.error ?? 'ok'}`}
            />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              disabled={passwordPending}
            />
          </label>
          <label className="auth-check">
            <input
              name="rememberMe"
              type="checkbox"
              value="true"
              defaultChecked
              disabled={passwordPending}
            />
            <span>Stay signed in on this device</span>
          </label>
          {passwordState.error ? (
            <p className="auth-error" role="alert">
              {passwordState.error}
            </p>
          ) : null}
          <button type="submit" className="primary" disabled={passwordPending}>
            {passwordPending ? 'Signing in…' : 'Sign in'}
          </button>
          {showHelperLinks ? (
            <p className="auth-helpers">
              <Link href="/forgot-password">Forgot password?</Link>
              {' · '}
              <Link href="/forgot-username">Forgot login email?</Link>
            </p>
          ) : null}
        </form>
      ) : null}

      {mode === 'magic' ? (
        <form className="auth-form" action={magicAction} noValidate>
          {next || magicState.next ? (
            <input type="hidden" name="next" value={magicState.next ?? next} />
          ) : null}
          <p className="auth-hint">
            We email a one-time link (Better Auth magicLink + Mailer). No new password needed.
          </p>
          <label>
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              disabled={magicPending}
              defaultValue={magicState.email ?? ''}
              key={`magic-email-${magicState.email ?? ''}-${magicState.success ?? 'ok'}`}
            />
          </label>
          {magicState.error ? (
            <p className="auth-error" role="alert">
              {magicState.error}
            </p>
          ) : null}
          <AuthCaptchaFields captcha={captcha} />
          {magicState.success ? (
            <p className="auth-success" role="status">
              {magicState.success}
            </p>
          ) : null}
          <button type="submit" className="primary" disabled={magicPending}>
            {magicPending ? 'Sending…' : 'Email magic link'}
          </button>
        </form>
      ) : null}

      {mode === 'otp' ? (
        <form className="auth-form" action={otpAction} noValidate>
          {next || otpState.next ? (
            <input type="hidden" name="next" value={otpState.next ?? next} />
          ) : null}
          <input type="hidden" name="intent" value={otpState.otpSent ? 'verify' : 'request'} />
          <p className="auth-hint">
            We email a one-time code (Better Auth emailOTP + Mailer). Enter the code to finish
            signing in.
          </p>
          <label>
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              disabled={otpPending}
              defaultValue={otpState.email ?? ''}
              key={`otp-email-${otpState.email ?? ''}-${otpState.otpSent ? 'sent' : 'req'}`}
            />
          </label>
          {otpState.otpSent ? (
            <>
              <label>
                One-time code
                <input
                  name="otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  disabled={otpPending}
                />
              </label>
              <label className="auth-check">
                <input
                  name="rememberMe"
                  type="checkbox"
                  value="true"
                  defaultChecked
                  disabled={otpPending}
                />
                <span>Stay signed in on this device</span>
              </label>
            </>
          ) : null}
          {/* Required on request / resend; verify OTP ignores the token. */}
          <AuthCaptchaFields captcha={captcha} />
          {otpState.error ? (
            <p className="auth-error" role="alert">
              {otpState.error}
            </p>
          ) : null}
          {otpState.success ? (
            <p className="auth-success" role="status">
              {otpState.success}
            </p>
          ) : null}
          <button type="submit" className="primary" disabled={otpPending}>
            {otpPending
              ? otpState.otpSent
                ? 'Verifying…'
                : 'Sending…'
              : otpState.otpSent
                ? 'Verify code & sign in'
                : 'Email me a code'}
          </button>
          {otpState.otpSent ? (
            <button
              type="submit"
              name="intent"
              value="request"
              className="secondary ghost"
              disabled={otpPending}
            >
              Send a new code
            </button>
          ) : null}
        </form>
      ) : null}
    </div>
  )
}
