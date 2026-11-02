import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getAppSession } from '@/core/auth/session'
import { getSiteSettings } from '@/core/settings'
import { ResetPasswordForm } from './reset-password-form'

export const metadata = {
  title: 'Reset password — Starforge',
  description: 'Choose a new password for your Starforge app account.',
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>
}) {
  const params = await searchParams
  const [session, settings] = await Promise.all([getAppSession(), getSiteSettings()])
  if (session) {
    redirect('/account/security')
  }

  const invalid = params.error === 'INVALID_TOKEN' || !params.token

  return (
    <div className="auth-page">
      <div className="auth-card">
        <p className="brand">{settings.siteName}</p>
        <h1>Reset password</h1>
        {invalid ? (
          <>
            <p className="lede">
              This reset link is missing, invalid, or expired. Request a new one — we keep the copy
              the same whether or not an account exists.
            </p>
            <p className="auth-switch">
              <Link href="/forgot-password">Request a new reset link</Link>
              {' · '}
              <Link href="/login">Sign in</Link>
            </p>
          </>
        ) : (
          <>
            <p className="lede">Choose a new password (at least 8 characters). Other sessions are signed out after a successful reset.</p>
            <ResetPasswordForm token={params.token!} />
            <p className="auth-switch">
              <Link href="/login">Back to sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
