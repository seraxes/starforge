import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getAppSession } from '@/core/auth/session'
import { getSiteSettings } from '@/core/settings'
import { AccountSecurityPanel } from './account-security-panel'

export const metadata = {
  title: 'Account security — Starforge',
  description: 'Manage two-factor authentication and recovery codes for your Starforge account.',
}

export default async function AccountSecurityPage() {
  const [session, settings] = await Promise.all([getAppSession(), getSiteSettings()])
  if (!session?.user) {
    redirect('/login?next=/account/security')
  }

  const user = session.user as { email: string; name: string; twoFactorEnabled?: boolean | null }

  return (
    <div className="auth-page">
      <div className="auth-card auth-card--wide">
        <p className="brand">{settings.siteName}</p>
        <h1>Account security</h1>
        <p className="lede">
          Signed in as <strong>{user.email}</strong>
          {user.name ? <> ({user.name})</> : null}. Enable authenticator 2FA (Better Auth{' '}
          <code>twoFactor</code> plugin) and keep recovery codes offline. Password reset and
          passwordless sign-in use the same Mailer.
        </p>
        <AccountSecurityPanel twoFactorEnabled={Boolean(user.twoFactorEnabled)} />
        <p className="auth-switch">
          <Link href="/">Home</Link>
          {' · '}
          <Link href="/forgot-password">Change password via email</Link>
          {' · '}
          <Link href="/login?mode=magic">Magic link sign-in</Link>
          {' · '}
          <Link href="/login?mode=otp">Email code sign-in</Link>
        </p>
      </div>
    </div>
  )
}
