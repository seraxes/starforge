import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getAppSession } from '@/core/auth/session'
import { safeNextPath } from '@/core/auth/actions'
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
  const session = await getAppSession()
  if (session) {
    redirect(next)
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <p className="brand">Starforge</p>
        <h1>Sign in</h1>
        <p className="lede">
          Sign in with the <strong>email</strong> you registered (not your
          display name). CMS editors use <Link href="/admin">Payload /admin</Link>{' '}
          instead — those accounts do not work here.
        </p>
        <LoginForm next={next === '/' ? undefined : next} />
        <p className="auth-switch">
          No account yet, or registered before the auth fix?{' '}
          <Link href="/register">Create a new app account</Link>
        </p>
      </div>
    </div>
  )
}
