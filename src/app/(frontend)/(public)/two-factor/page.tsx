import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getAppSession } from '@/core/auth/session'
import { safeNextPath } from '@/core/auth/safe-next-path'
import { getSiteSettings } from '@/core/settings'
import { TwoFactorForm } from './two-factor-form'

export const metadata = {
  title: 'Two-factor authentication — Starforge',
  description: 'Enter your authenticator or recovery code to finish signing in.',
}

export default async function TwoFactorPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const params = await searchParams
  const next = safeNextPath(params.next, '/')
  const [session, settings] = await Promise.all([getAppSession(), getSiteSettings()])
  if (session) {
    redirect(next)
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <p className="brand">{settings.siteName}</p>
        <h1>Two-factor check</h1>
        <p className="lede">
          This account has authenticator 2FA enabled. Enter a 6-digit code from your app, or a
          one-time recovery code. You can trust this device to skip prompts for a while.
        </p>
        <TwoFactorForm next={next === '/' ? undefined : next} />
        <p className="auth-switch">
          <Link href="/login">Back to sign in</Link>
          {' · '}
          <Link href="/forgot-password">Forgot password?</Link>
        </p>
      </div>
    </div>
  )
}
