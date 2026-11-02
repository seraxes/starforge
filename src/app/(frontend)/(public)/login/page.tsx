import React from 'react'
import { redirect } from 'next/navigation'

import { AuthWelcomePanel } from '@/components/AuthWelcomePanel'
import { getAppSession } from '@/core/auth/session'
import { safeNextPath } from '@/core/auth/safe-next-path'
import { getSiteSettings } from '@/core/settings'
import { parseLoginMode } from './login-form'

export const metadata = {
  title: 'Sign in — Starforge',
  description: 'Sign in to Starforge (one login for app and CMS when you have CMS access).',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string; error?: string; mode?: string }>
}) {
  const params = await searchParams
  const next = safeNextPath(params.next, '/')
  const [session, settings] = await Promise.all([getAppSession(), getSiteSettings()])
  if (session) {
    redirect(next)
  }

  return (
    <div className="auth-page">
      <AuthWelcomePanel
        siteName={settings.siteName}
        variant="page"
        title="Sign in"
        registrationEnabled={settings.features.registration}
        welcomeNote="Welcome — password, magic link, or email code. Stay signed in when you trust this device. After sign-in, set up authenticator 2FA under Account security."
        next={next === '/' ? undefined : next}
        resetSuccess={params.reset === '1'}
        magicError={params.error === 'magic_link'}
        initialMode={parseLoginMode(params.mode)}
        showForm
      />
    </div>
  )
}
