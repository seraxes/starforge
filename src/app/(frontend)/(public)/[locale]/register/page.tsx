import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getAppSession } from '@/core/auth/session'
import { resolvePostRegisterUrl } from '@/core/auth/success-urls'
import { resolveCaptchaForSurface } from '@/core/security/captcha'
import { getSiteSettings } from '@/core/settings'
import { getSiteChrome } from '@/core/site-chrome'
import { RegisterForm } from './register-form'

export const metadata = {
  title: 'Register — Starforge',
  description: 'Create a Starforge app account (not a Payload CMS editor).',
}

export default async function RegisterPage() {
  const [session, settings, chrome] = await Promise.all([
    getAppSession(),
    getSiteSettings(),
    getSiteChrome(),
  ])
  if (session) {
    redirect(await resolvePostRegisterUrl())
  }

  if (!settings.features.registration) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <p className="brand">{settings.siteName}</p>
          <h1>Registration closed</h1>
          <p className="lede">
            New app accounts are turned off in site settings (feature toggle). Existing users can{' '}
            <Link href="/login">sign in</Link>. Core admins can re-enable registration at{' '}
            <Link href="/admin/settings/auth">/admin/settings/auth</Link>.
          </p>
          <p className="auth-switch">
            <Link href="/">Back to home</Link>
          </p>
        </div>
      </div>
    )
  }

  const captcha = await resolveCaptchaForSurface('register')
  const requireEmailVerification = chrome.authRequireEmailVerification

  return (
    <div className="auth-page">
      <div className="auth-card">
        <p className="brand">{settings.siteName}</p>
        <h1>Create account</h1>
        <p className="lede">
          Registers a <strong>core app user</strong>. Your email is the sign-in ID.
          {requireEmailVerification
            ? ' We email a verification link — open it before signing in.'
            : null}{' '}
          After you are signed in you can enable authenticator 2FA under{' '}
          <Link href="/account/security">Account security</Link>. CMS access is granted
          separately by an admin (one login still — no second password at{' '}
          <Link href="/cms/admin">/cms/admin</Link>).
        </p>
        <RegisterForm captcha={captcha} requireEmailVerification={requireEmailVerification} />
        <p className="auth-switch">
          Already have an account? <Link href="/login">Sign in</Link>
          {' · '}
          <Link href="/forgot-password">Forgot password?</Link>
          {' · '}
          <Link href="/forgot-username">Forgot login email?</Link>
          {' · '}
          <Link href="/login?mode=magic">Magic link</Link>
          {' · '}
          <Link href="/account/security">2FA after sign-in</Link>
        </p>
      </div>
    </div>
  )
}
