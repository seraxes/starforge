'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { signUp } from '@/core/auth/client'
import { registerSchema } from '@/core/auth/schemas'

export function RegisterForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const form = new FormData(event.currentTarget)
    const parsed = registerSchema.safeParse({
      name: form.get('name'),
      email: form.get('email'),
      password: form.get('password'),
    })

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid form')
      return
    }

    startTransition(async () => {
      const result = await signUp.email({
        name: parsed.data.name,
        email: parsed.data.email,
        password: parsed.data.password,
      })

      if (result.error) {
        setError(result.error.message || 'Could not register')
        return
      }

      router.replace('/')
      router.refresh()
    })
  }

  return (
    <form className="auth-form" onSubmit={onSubmit} noValidate>
      <label>
        Name
        <input
          name="name"
          type="text"
          autoComplete="name"
          required
          disabled={pending}
        />
      </label>
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
          autoComplete="new-password"
          required
          minLength={8}
          disabled={pending}
        />
      </label>
      {error ? <p className="auth-error" role="alert">{error}</p> : null}
      <button type="submit" className="primary" disabled={pending}>
        {pending ? 'Creating account…' : 'Create account'}
      </button>
    </form>
  )
}
