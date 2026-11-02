'use client'

import React, { useTransition } from 'react'

import { logoutAction } from '@/core/auth/actions'

export function SignOutButton() {
  const [pending, startTransition] = useTransition()

  return (
    <button
      type="button"
      className="secondary ghost"
      disabled={pending}
      onClick={() => {
        startTransition(() => {
          void logoutAction()
        })
      }}
    >
      {pending ? 'Signing out…' : 'Sign out'}
    </button>
  )
}
