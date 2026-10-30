import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getAppSession } from '@/core/auth/session'
import { LoginForm } from './login-form'

export const metadata = {
  title: 'Sign in — Starforge',
  description: 'Sign in to your Starforge app account (not Payload CMS).',
}

export default async function LoginPage() {
  const session = await getAppSession()
  if (session) {
    redirect('/')
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <p className="brand">Starforge</p>
        <h1>Sign in</h1>
        <p className="lede">
          App account login. CMS editors use{' '}
          <Link href="/admin">Payload /admin</Link> instead.
        </p>
        <LoginForm />
        <p className="auth-switch">
          No account yet? <Link href="/register">Register</Link>
        </p>
      </div>
    </div>
  )
}
