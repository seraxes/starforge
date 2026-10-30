'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { signIn } from '@/core/auth/client'
import { loginSchema } from '@/core/auth/schemas'

export function LoginForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const form = new FormData(event.currentTarget)
    const parsed = loginSchema.safeParse({
      email: form.get('email'),
      password: form.get('password'),
    })

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid form')
      return
    }

    startTransition(async () => {
      const result = await signIn.email({
        email: parsed.data.email,
        password: parsed.data.password,
      })

      if (result.error) {
        setError(result.error.message || 'Could not sign in')
        return
      }

      router.replace('/')
      router.refresh()
    })
  }

  return (
    <form className="auth-form" onSubmit={onSubmit} noValidate>
      <label>
        Email
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={pending}
        />
      </label>
      <label>
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
          disabled={pending}
        />
      </label>
      {error ? <p className="auth-error" role="alert">{error}</p> : null}
      <button type="submit" className="primary" disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
