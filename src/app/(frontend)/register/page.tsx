import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getAppSession } from '@/core/auth/session'
import { RegisterForm } from './register-form'

export const metadata = {
  title: 'Register — Starforge',
  description: 'Create a Starforge app account (not a Payload CMS editor).',
}

export default async function RegisterPage() {
  const session = await getAppSession()
  if (session) {
    redirect('/')
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <p className="brand">Starforge</p>
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
