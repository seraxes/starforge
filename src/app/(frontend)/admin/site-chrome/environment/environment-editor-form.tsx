'use client'

import React, { useActionState } from 'react'

import {
  lockEnvEditorAction,
  saveEnvEditorAction,
  type EnvEditorLockActionState,
  type EnvEditorSaveActionState,
} from '@/core/env-editor/actions'
import { ENV_EDITOR_GROUPS } from '@/core/env-editor/catalog'
import type { EnvEditorSnapshot } from '@/core/env-editor/types'

import { useNotifySavedOnOk } from '../../admin-toast'

const saveInitial: EnvEditorSaveActionState = {}
const lockInitial: EnvEditorLockActionState = {}

type Props = {
  snapshot: EnvEditorSnapshot
  expiresAt: number | null
}

export function EnvironmentEditorForm({ snapshot, expiresAt }: Props) {
  const [saveState, saveAction, savePending] = useActionState(saveEnvEditorAction, saveInitial)
  const [, lockAction, lockPending] = useActionState(lockEnvEditorAction, lockInitial)
  useNotifySavedOnOk(saveState, { toastErrors: true })

  const expiresLabel = expiresAt
    ? new Date(expiresAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="env-editor">
      <div className="env-editor-toolbar">
        <form action={lockAction}>
          <button type="submit" className="secondary" disabled={lockPending}>
            {lockPending ? 'Locking…' : 'Lock panel'}
          </button>
        </form>
        {expiresLabel ? (
          <p className="field-hint env-editor-expiry">Gate expires ~{expiresLabel}</p>
        ) : null}
      </div>

      <form action={saveAction} className="settings-form settings-form-wide">
        <p className="settings-hint">
          Overlay file: <code>{snapshot.overlayPath}</code>
          {snapshot.overlayExists ? '' : ' (will be created on first save)'}. Mode:{' '}
          <strong>{snapshot.writeMode}</strong> (NODE_ENV={snapshot.nodeEnv}). After a write,
          restart the Node / <code>next dev</code> process so Next reloads env.
        </p>

        {!snapshot.writable ? (
          <p className="admin-inline-error" role="status">
            Read-only in this process. Production defaults to read-only; set{' '}
            <code>STARFORGE_ENV_EDITOR=write</code> only when you intentionally allow file writes.
          </p>
        ) : null}

        <div className="admin-settings-mosaic">
        {ENV_EDITOR_GROUPS.map((group) => {
          const rows = snapshot.rows.filter((r) => r.field.group === group.id)
          if (!rows.length) return null
          return (
            <fieldset key={group.id} className="settings-fieldset">
              <legend>{group.label}</legend>
              <p className="settings-hint">{group.hint}</p>
              {rows.map(({ field, displayValue, overlay, isSet }) => (
                <label key={field.key} className="settings-field">
                  <span>
                    {field.label}
                    {field.secret ? (
                      <span className="page-settings-acl"> Secret</span>
                    ) : null}
                  </span>
                  {field.kind === 'enum' && field.options ? (
                    <select
                      name={`env.${field.key}`}
                      defaultValue={overlay || displayValue}
                      disabled={savePending || !snapshot.writable}
                    >
                      {field.options.map((opt) => (
                        <option key={opt.value || '__empty'} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.secret ? 'password' : field.kind === 'url' ? 'url' : 'text'}
                      name={`env.${field.key}`}
                      defaultValue={field.secret ? '' : overlay || displayValue}
                      placeholder={
                        field.secret
                          ? isSet
                            ? displayValue || 'set — leave blank to keep'
                            : 'unset'
                          : undefined
                      }
                      autoComplete="off"
                      spellCheck={false}
                      className="settings-field-mono"
                      disabled={savePending || !snapshot.writable}
                    />
                  )}
                  <span className="settings-flag-desc">{field.description}</span>
                  {field.warning ? (
                    <span className="settings-flag-desc admin-inline-error">{field.warning}</span>
                  ) : null}
                  {field.secret && isSet ? (
                    <span className="settings-flag-desc">
                      Currently set ({displayValue}). Leave blank to keep; enter a new value to
                      replace in <code>.env.local</code>.
                    </span>
                  ) : null}
                </label>
              ))}
            </fieldset>
          )
        })}
        </div>

        {saveState.error ? (
          <p className="admin-inline-error" role="alert">
            {saveState.error}
          </p>
        ) : null}
        {saveState.ok && saveState.message ? (
          <p className="admin-inline-ok" role="status">
            {saveState.message}
          </p>
        ) : null}

        {snapshot.writable ? (
          <p>
            <button type="submit" className="primary" disabled={savePending}>
              {savePending ? 'Writing…' : 'Write .env.local'}
            </button>
          </p>
        ) : null}
      </form>
    </div>
  )
}
