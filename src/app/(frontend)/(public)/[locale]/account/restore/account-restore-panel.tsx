'use client'

import React, { useActionState } from 'react'
import { useRouter } from 'next/navigation'

import {
  restoreAccountAction,
  type RestoreAccountActionState,
} from '@/core/auth/account-actions'

const initial: RestoreAccountActionState = {}

export function AccountRestorePanel({
  purgeEligibleAt,
  next,
}: {
  purgeEligibleAt: string | null
  next?: string
}) {
  const router = useRouter()
  const [state, action, pending] = useActionState(
    async (prev: RestoreAccountActionState, formData: FormData) => {
      const result = await restoreAccountAction(prev, formData)
      if (result.ok) {
        router.replace(next && next.startsWith('/') ? next : '/')
        router.refresh()
      }
      return result
    },
    initial,
  )

  return (
    <div className="auth-security">
      {state.error ? (
        <p className="auth-error" role="alert">
          {state.error}
        </p>
      ) : null}
      {purgeEligibleAt ? (
        <p className="auth-hint">
          Purge eligible after <time dateTime={purgeEligibleAt}>{purgeEligibleAt}</time> unless you
          restore first.
        </p>
      ) : null}
      <form className="auth-form" action={action} noValidate>
        <button type="submit" className="primary" disabled={pending}>
          {pending ? 'Restoring…' : 'Restore my account'}
        </button>
      </form>
    </div>
  )
}
