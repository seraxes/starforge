import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getAppSession } from '@/core/auth/session'
import { resolveCaptchaForSurface } from '@/core/security/captcha'
import { getSiteSettings } from '@/core/settings'
import { ForgotPasswordForm } from './forgot-password-form'

export const metadata = {
  title: 'Forgot password — Starforge',
  description: 'Request a password reset link for your Starforge app account.',
}

export default async function ForgotPasswordPage() {
  const [session, settings] = await Promise.all([getAppSession(), getSiteSettings()])
  if (session) {
    redirect('/account/security')
  }

  const captcha = await resolveCaptchaForSurface('auth-recovery')

  return (
    <div className="auth-page">
      <div className="auth-card">
        <p className="brand">{settings.siteName}</p>
        <h1>Forgot password</h1>
        <p className="lede">
          Enter the <strong>email</strong> you registered with. If an account exists, we email a
          reset link (via Chrome Mailer — console / SMTP / Resend). Links expire; you can
          request again if nothing arrives.
        </p>
        <ForgotPasswordForm captcha={captcha} />
        <p className="auth-switch">
          <Link href="/login">Back to sign in</Link>
          {' · '}
          <Link href="/forgot-username">Forgot login email?</Link>
        </p>
      </div>
    </div>
  )
}
