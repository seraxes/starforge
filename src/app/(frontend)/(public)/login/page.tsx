import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getAppSession } from '@/core/auth/session'
import { safeNextPath } from '@/core/auth/safe-next-path'
import { getSiteSettings } from '@/core/settings'
import { LoginForm } from './login-form'

export const metadata = {
  title: 'Sign in — Starforge',
  description: 'Sign in to your Starforge app account (not Payload CMS).',
}

export default async function LoginPage({
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
        <h1>Sign in</h1>
        <p className="lede">
          Sign in with the <strong>email</strong> you registered (not your
          display name). CMS editors use <Link href="/admin">Payload /admin</Link>{' '}
          instead — those accounts do not work here.
        </p>
        <LoginForm next={next === '/' ? undefined : next} />
        <p className="auth-switch">
          {settings.features.registration ? (
            <>
              No account yet, or registered before the auth fix?{' '}
              <Link href="/register">Create a new app account</Link>
            </>
          ) : (
            <>Registration is currently off. Ask a core admin if you need a new account.</>
          )}
        </p>
      </div>
    </div>
  )
}
