'use client'

import React, { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'

import {
  cancelEmailBroadcastAction,
  pauseEmailBroadcastAction,
  resumeEmailBroadcastAction,
  saveEmailManagerSettingsAction,
  type EmailAdminActionState,
} from '../actions'
import type { EmailBroadcastRecord, EmailManagerModuleSettings } from '../types'
import {
  EMAIL_BROADCAST_BATCH_MAX,
  EMAIL_BROADCAST_BATCH_MIN,
  EMAIL_BROADCAST_GAP_MAX,
  EMAIL_BROADCAST_GAP_MIN,
  EMAIL_BROADCAST_RECIPIENT_CAP,
} from '../types'

type BroadcastRow = Omit<EmailBroadcastRecord, 'nextRunAt' | 'createdAt' | 'updatedAt'> & {
  nextRunAt: Date | string | null
  createdAt: Date | string
  updatedAt: Date | string
}

type Props = {
  settings: EmailManagerModuleSettings
  broadcasts: BroadcastRow[]
  unavailable: boolean
}

const initial: EmailAdminActionState = {}

function Feedback({ state }: { state: EmailAdminActionState }) {
  if (state.error) {
    return (
      <p className="admin-inline-error" role="alert">
        {state.error}
      </p>
    )
  }
  if (state.ok && state.message) {
    return (
      <p className="admin-inline-ok" role="status">
        {state.message}
      </p>
    )
  }
  return null
}

function formatWhen(date: Date | string | null | undefined): string {
  if (!date) return '—'
  try {
    const d = date instanceof Date ? date : new Date(date)
    if (Number.isNaN(d.getTime())) return '—'
    // Stable UTC string — avoid toLocaleString hydration mismatch.
    return d.toISOString().replace('T', ' ').slice(0, 16)
  } catch {
    return '—'
  }
}

function progressLabel(row: BroadcastRow): string {
  const done = row.sentCount + row.failedCount + row.skippedCount
  return `${done}/${row.totalCount}`
}

export function EmailBroadcastsManager({
  settings,
  broadcasts,
  unavailable,
}: Props) {
  const router = useRouter()
  const [settingsState, settingsAction, settingsPending] = useActionState(
    saveEmailManagerSettingsAction,
    initial,
  )
  const [pauseState, pauseAction, pausePending] = useActionState(
    pauseEmailBroadcastAction,
    initial,
  )
  const [resumeState, resumeAction, resumePending] = useActionState(
    resumeEmailBroadcastAction,
    initial,
  )
  const [cancelState, cancelAction, cancelPending] = useActionState(
    cancelEmailBroadcastAction,
    initial,
  )

  useNotifySavedOnOk(settingsState)
  useNotifySavedOnOk(pauseState)
  useNotifySavedOnOk(resumeState)
  useNotifySavedOnOk(cancelState)

  useEffect(() => {
    if (settingsState.ok || pauseState.ok || resumeState.ok || cancelState.ok) {
      router.refresh()
    }
  }, [settingsState, pauseState, resumeState, cancelState, router])

  const busy = settingsPending || pausePending || resumePending || cancelPending

  return (
    <div className="sf-email-broadcasts-manager admin-settings-mosaic">
      <form action={settingsAction} className="page-settings-panel">
        <header className="page-settings-panel-head">
          <h3>Pace rules</h3>
        </header>
        <div className="page-settings-panel-body">
          <p className="settings-hint">
            Bulk sends (event registrants, later campaigns callers) go through this queue:
            send a batch, wait, then continue. Cap per broadcast:{' '}
            <strong>{EMAIL_BROADCAST_RECIPIENT_CAP}</strong> recipients. Transactional
            triggers stay immediate.
          </p>
          <label className="settings-field">
            <span>Batch size</span>
            <input
              type="number"
              name="broadcastBatchSize"
              min={EMAIL_BROADCAST_BATCH_MIN}
              max={EMAIL_BROADCAST_BATCH_MAX}
              defaultValue={settings.broadcastBatchSize}
              disabled={busy}
              required
            />
            <span className="settings-hint">
              Recipients per slice ({EMAIL_BROADCAST_BATCH_MIN}–{EMAIL_BROADCAST_BATCH_MAX}).
              Default 20.
            </span>
          </label>
          <label className="settings-field">
            <span>Gap (minutes)</span>
            <input
              type="number"
              name="broadcastGapMinutes"
              min={EMAIL_BROADCAST_GAP_MIN}
              max={EMAIL_BROADCAST_GAP_MAX}
              defaultValue={settings.broadcastGapMinutes}
              disabled={busy}
              required
            />
            <span className="settings-hint">
              Wait between slices ({EMAIL_BROADCAST_GAP_MIN}–{EMAIL_BROADCAST_GAP_MAX}{' '}
              minutes). Default 10.
            </span>
          </label>
          <Feedback state={settingsState} />
        </div>
        <div className="page-settings-actions">
          <button
            type="submit"
            className="gantry-toolbar-btn gantry-toolbar-btn-save"
            disabled={busy}
          >
            {settingsPending ? 'Saving…' : 'Save pace rules'}
          </button>
        </div>
      </form>

      <section className="outlines-create" aria-label="Broadcast queue">
        <h3>Broadcasts</h3>
        <p className="field-hint">
          Caller-supplied audiences (e.g. Events → registrants). Pause stops the next
          batch; already-sent rows stay sent.
        </p>
      </section>

      <div className="outlines-table-wrap admin-settings-panel-wide" aria-label="Broadcast list">
        <table className="outlines-table">
          <thead>
            <tr>
              <th scope="col">Label</th>
              <th scope="col">Status</th>
              <th scope="col">Progress</th>
              <th scope="col">Pace</th>
              <th scope="col">Next run</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {broadcasts.length === 0 ? (
              <tr>
                <td colSpan={6} className="admin-empty">
                  {unavailable
                    ? 'Broadcast tables are unavailable (run db:migrate).'
                    : 'No broadcasts yet. Queue one from Events → Registrants or another caller.'}
                </td>
              </tr>
            ) : (
              broadcasts.map((row) => {
                const canPause = row.status === 'queued' || row.status === 'running'
                const canResume = row.status === 'paused'
                const canCancel =
                  row.status === 'queued' ||
                  row.status === 'running' ||
                  row.status === 'paused'
                return (
                  <tr key={row.id} title={row.lastError || row.sourceKey || undefined}>
                    <td>
                      <strong>{row.label}</strong>
                      <span className="field-hint"> ({row.moduleCategory})</span>
                    </td>
                    <td>{row.status}</td>
                    <td>
                      {progressLabel(row)}
                      {row.failedCount > 0 ? (
                        <span className="field-hint"> · {row.failedCount} failed</span>
                      ) : null}
                    </td>
                    <td>
                      {row.batchSize} / {row.gapMinutes}m
                    </td>
                    <td>{formatWhen(row.nextRunAt)}</td>
                    <td>
                      <div className="admin-inline-actions">
                        {canPause ? (
                          <form action={pauseAction}>
                            <input type="hidden" name="id" value={row.id} />
                            <button
                              type="submit"
                              className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                              disabled={busy}
                            >
                              Pause
                            </button>
                          </form>
                        ) : null}
                        {canResume ? (
                          <form action={resumeAction}>
                            <input type="hidden" name="id" value={row.id} />
                            <button
                              type="submit"
                              className="gantry-toolbar-btn"
                              disabled={busy}
                            >
                              Resume
                            </button>
                          </form>
                        ) : null}
                        {canCancel ? (
                          <form action={cancelAction}>
                            <input type="hidden" name="id" value={row.id} />
                            <button
                              type="submit"
                              className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                              disabled={busy}
                            >
                              Cancel
                            </button>
                          </form>
                        ) : null}
                      </div>
                      <Feedback
                        state={
                          pauseState.id === row.id
                            ? pauseState
                            : resumeState.id === row.id
                              ? resumeState
                              : cancelState.id === row.id
                                ? cancelState
                                : {}
                        }
                      />
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
