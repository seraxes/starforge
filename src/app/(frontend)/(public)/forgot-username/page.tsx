import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getAppSession } from '@/core/auth/session'
import { getSiteSettings } from '@/core/settings'
import { ForgotUsernameForm } from './forgot-username-form'

export const metadata = {
  title: 'Forgot login email — Starforge',
  description: 'Recover a reminder of your Starforge sign-in email.',
}

export default async function ForgotUsernamePage() {
  const [session, settings] = await Promise.all([getAppSession(), getSiteSettings()])
  if (session) {
    redirect('/')
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <p className="brand">{settings.siteName}</p>
        <h1>Forgot login email</h1>
        <p className="lede">
          Starforge signs in with <strong>email</strong>, not a separate username (display name is
          only a label). Enter the email you think you used — if an account exists, we send a
          reminder with that sign-in email and your display name.
        </p>
        <ForgotUsernameForm />
        <p className="auth-switch">
          <Link href="/login">Back to sign in</Link>
          {' · '}
          <Link href="/forgot-password">Forgot password?</Link>
        </p>
      </div>
    </div>
  )
}
