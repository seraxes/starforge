'use client'

import React, { useActionState, useMemo } from 'react'
import QRCode from 'react-qr-code'

import {
  deleteAccountAction,
  type DeleteAccountActionState,
} from '@/core/auth/account-actions'
import {
  disableTwoFactorAction,
  enableTwoFactorAction,
  regenerateBackupCodesAction,
  verifyTotpEnrollAction,
  type TwoFactorActionState,
} from '@/core/auth/two-factor-actions'

const initial: TwoFactorActionState = {}
const deleteInitial: DeleteAccountActionState = {}

function secretFromTotpUri(uri: string | undefined): string | null {
  if (!uri) return null
  try {
    const u = new URL(uri)
    return u.searchParams.get('secret')
  } catch {
    return null
  }
}

export function AccountSecurityPanel({ twoFactorEnabled }: { twoFactorEnabled: boolean }) {
  const [enableState, enableAction, enablePending] = useActionState(enableTwoFactorAction, initial)
  const [verifyState, verifyAction, verifyPending] = useActionState(verifyTotpEnrollAction, initial)
  const [disableState, disableAction, disablePending] = useActionState(disableTwoFactorAction, initial)
  const [regenState, regenAction, regenPending] = useActionState(
    regenerateBackupCodesAction,
    initial,
  )
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteAccountAction,
    deleteInitial,
  )

  const totpURI = enableState.totpURI
  const enrollBackupCodes = enableState.backupCodes
  const regenBackupCodes = regenState.backupCodes
  const secret = useMemo(() => secretFromTotpUri(totpURI), [totpURI])
  const showEnroll = Boolean(totpURI) && verifyState.enabled !== true

  let statusEnabled = twoFactorEnabled
  if (verifyState.enabled === true) statusEnabled = true
  if (disableState.enabled === false) statusEnabled = false
  if (showEnroll) statusEnabled = false

  const alert =
    enableState.error ||
    verifyState.error ||
    disableState.error ||
    regenState.error ||
    deleteState.error ||
    null
  const notice =
    verifyState.success ||
    disableState.success ||
    regenState.success ||
    enableState.success ||
    null

  return (
    <div className="auth-security">
      {alert ? (
        <p className="auth-error" role="alert">
          {alert}
        </p>
      ) : null}
      {notice ? (
        <p className="auth-success" role="status">
          {notice}
        </p>
      ) : null}

      {showEnroll ? (
        <div className="auth-enroll">
          <p className="auth-hint">Scan with Google Authenticator, 1Password, Authy, etc.</p>
          {totpURI ? (
            <div className="auth-qr" aria-label="TOTP QR code">
              <QRCode value={totpURI} size={168} />
            </div>
          ) : null}
          {secret ? (
            <p className="auth-hint">
              Manual secret: <code>{secret}</code>
            </p>
          ) : null}
          {enrollBackupCodes?.length ? (
            <div className="auth-backup-codes">
              <p className="auth-hint">Recovery codes (save offline — each works once):</p>
              <ul>
                {enrollBackupCodes.map((code) => (
                  <li key={code}>
                    <code>{code}</code>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <form className="auth-form" action={verifyAction} noValidate>
            <input type="hidden" name="totpURI" value={totpURI ?? ''} />
            <input type="hidden" name="backupCodes" value={(enrollBackupCodes ?? []).join(' ')} />
            <label>
              Confirm with a 6-digit code
              <input
                name="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                pattern="\d{6}"
                disabled={verifyPending}
              />
            </label>
            <button type="submit" className="primary" disabled={verifyPending}>
              {verifyPending ? 'Verifying…' : 'Finish enabling 2FA'}
            </button>
          </form>
        </div>
      ) : null}

      {!showEnroll && !statusEnabled ? (
        <form className="auth-form" action={enableAction} noValidate>
          <p className="auth-hint">
            Status: <strong>off</strong>. Enabling requires your current password, then a TOTP
            confirmation.
          </p>
          <label>
            Current password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              disabled={enablePending}
            />
          </label>
          <button type="submit" className="primary" disabled={enablePending}>
            {enablePending ? 'Starting…' : 'Enable authenticator 2FA'}
          </button>
        </form>
      ) : null}

      {!showEnroll && statusEnabled ? (
        <>
          <p className="auth-hint">
            Status: <strong>on</strong>. Password sign-in asks for a TOTP or recovery code.
          </p>
          <form className="auth-form" action={regenAction} noValidate>
            <label>
              Current password (to regenerate recovery codes)
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                disabled={regenPending}
              />
            </label>
            <button type="submit" className="secondary" disabled={regenPending}>
              {regenPending ? 'Generating…' : 'Regenerate recovery codes'}
            </button>
          </form>
          {regenBackupCodes?.length ? (
            <div className="auth-backup-codes">
              <p className="auth-hint">New recovery codes:</p>
              <ul>
                {regenBackupCodes.map((code) => (
                  <li key={code}>
                    <code>{code}</code>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <form className="auth-form" action={disableAction} noValidate>
            <label>
              Current password (to disable 2FA)
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                disabled={disablePending}
              />
            </label>
            <button type="submit" className="secondary ghost" disabled={disablePending}>
              {disablePending ? 'Disabling…' : 'Disable 2FA'}
            </button>
          </form>
        </>
      ) : null}

      <section className="auth-account-data" aria-labelledby="auth-account-data-heading">
        <h2 id="auth-account-data-heading" className="auth-account-data-title">
          Your data
        </h2>
        <p className="auth-hint">
          Download a JSON copy of your account (and profile when Profiles is on). Deleting your
          account is permanent and requires your current password.
        </p>
        <form className="auth-form" action={deleteAction} noValidate>
          <label>
            Current password (required to delete)
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              disabled={deletePending}
            />
          </label>
          <div className="page-settings-actions auth-account-data-actions">
            <a href="/api/account/download" className="gantry-btn" download>
              Download my data
            </a>
            <button type="submit" className="gantry-btn" disabled={deletePending}>
              {deletePending ? 'Deleting…' : 'Delete my account'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
