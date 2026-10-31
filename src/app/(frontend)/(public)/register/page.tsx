import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getAppSession } from '@/core/auth/session'
import { getSiteSettings } from '@/core/settings'
import { RegisterForm } from './register-form'

export const metadata = {
  title: 'Register — Starforge',
  description: 'Create a Starforge app account (not a Payload CMS editor).',
}

export default async function RegisterPage() {
  const [session, settings] = await Promise.all([getAppSession(), getSiteSettings()])
  if (session) {
    redirect('/')
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
            <Link href="/app/admin/settings">/app/admin/settings</Link>.
          </p>
          <p className="auth-switch">
            <Link href="/">Back to home</Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <p className="brand">{settings.siteName}</p>
        <h1>Create account</h1>
        <p className="lede">
          Registers a <strong>core app user</strong>. Payload CMS editors are
          created separately at <Link href="/admin">/admin</Link>.
        </p>
        <RegisterForm />
        <p className="auth-switch">
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
