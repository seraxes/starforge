'use client'

import React, { useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { signOut } from '@/core/auth/client'

export function SignOutButton() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <button
      type="button"
      className="secondary ghost"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await signOut()
          router.replace('/')
          router.refresh()
        })
      }}
    >
      {pending ? 'Signing out…' : 'Sign out'}
    </button>
  )
}
