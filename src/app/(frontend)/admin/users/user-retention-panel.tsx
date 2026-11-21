'use client'

import React, { useActionState } from 'react'

import {
  approveFinalDeleteAccountAction,
  restoreAccountAction,
  setAccountLegalHoldAction,
  type FinalDeleteAccountActionState,
  type LegalHoldActionState,
  type RestoreAccountActionState,
} from '@/core/auth/account-actions'

const restoreInitial: RestoreAccountActionState = {}
const holdInitial: LegalHoldActionState = {}
const finalInitial: FinalDeleteAccountActionState = {}

export function UserRetentionPanel({
  userId,
  hiddenAt,
  purgeEligibleAt,
  legalHold,
}: {
  userId: string
  hiddenAt: string | null
  purgeEligibleAt: string | null
  legalHold: boolean
}) {
  const [restoreState, restoreAction, restorePending] = useActionState(
    restoreAccountAction,
    restoreInitial,
  )
  const [holdState, holdAction, holdPending] = useActionState(
    setAccountLegalHoldAction,
    holdInitial,
  )
  const [finalState, finalAction, finalPending] = useActionState(
    approveFinalDeleteAccountAction,
    finalInitial,
  )

  const alert = restoreState.error || holdState.error || finalState.error || null
  const notice =
    (restoreState.ok ? 'Account restored.' : null) ||
    (holdState.ok
      ? holdState.legalHold
        ? 'Legal hold set.'
        : 'Legal hold cleared.'
      : null) ||
    (finalState.ok ? 'Account finally deleted.' : null)

  return (
    <div className="page-settings-panel">
      <div className="page-settings-panel-head">
        <h3>Account retention</h3>
      </div>
      <div className="page-settings-panel-body">
        {alert ? (
          <p className="admin-inline-error" role="alert">
            {alert}
          </p>
        ) : null}
        {notice ? (
          <p className="admin-inline-ok" role="status">
            {notice}
          </p>
        ) : null}
        <p className="settings-hint">
          {hiddenAt
            ? `Hidden at ${hiddenAt}. Purge eligible at ${purgeEligibleAt ?? '—'}.`
            : 'Not in the retention wait.'}
          {legalHold ? ' Legal hold is on.' : ''}
        </p>
        {hiddenAt ? (
          <div className="page-settings-actions">
            <form action={restoreAction}>
              <input type="hidden" name="userId" value={userId} />
              <button type="submit" className="gantry-toolbar-btn" disabled={restorePending}>
                {restorePending ? 'Restoring…' : 'Restore'}
              </button>
            </form>
            <form action={holdAction}>
              <input type="hidden" name="userId" value={userId} />
              <input type="hidden" name="legalHold" value={legalHold ? 'false' : 'true'} />
              <button type="submit" className="gantry-toolbar-btn" disabled={holdPending}>
                {holdPending
                  ? 'Saving…'
                  : legalHold
                    ? 'Clear legal hold'
                    : 'Set legal hold'}
              </button>
            </form>
            <form action={finalAction}>
              <input type="hidden" name="userId" value={userId} />
              <button
                type="submit"
                className="gantry-toolbar-btn"
                disabled={finalPending}
              >
                {finalPending ? 'Deleting…' : 'Approve final delete'}
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </div>
  )
}
