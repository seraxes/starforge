'use client'

import React, { useState, useTransition } from 'react'
import Link from 'next/link'

import { ensureMyCmsBridgeAccount, type CmsBridgeActionState } from '@/core/cms-bridge/actions'

export function CmsBridgePanel(props: { initiallyLinked: boolean; email: string }) {
  const [state, setState] = useState<CmsBridgeActionState | null>(null)
  const [pending, startTransition] = useTransition()
  const linked = state?.status === 'created' || state?.status === 'exists' || props.initiallyLinked

  function onEnsure() {
    startTransition(async () => {
      const result = await ensureMyCmsBridgeAccount()
      setState(result)
    })
  }

  return (
    <div className="cms-bridge-panel">
      <div className="cms-bridge-actions">
        <Link className="primary" href="/admin">
          Open Payload CMS
        </Link>
        <button type="button" className="secondary" disabled={pending} onClick={onEnsure}>
          {pending ? 'Ensuring…' : linked ? 'Re-check CMS link' : 'Ensure my CMS editor account'}
        </button>
      </div>

      {state ? (
        <p className={state.ok ? 'admin-inline-ok' : 'admin-inline-error'} role="status">
          {state.message}
        </p>
      ) : null}

      {state?.ok && state.bridgePasswordHint ? (
        <p className="cms-bridge-password-hint" role="status">
          Sign in at <Link href="/admin">/admin</Link> with <code>{props.email}</code> /{' '}
          <code>{state.bridgePasswordHint}</code>
        </p>
      ) : null}

      {!linked && !state ? (
        <p className="session-hint">
          No Payload editor for this email yet. Click <strong>Ensure my CMS editor account</strong>{' '}
          (or run <code>npm run seed</code> for the bootstrap admin), then open Payload CMS.
        </p>
      ) : null}
    </div>
  )
}
