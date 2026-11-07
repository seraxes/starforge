'use client'

import React, { useActionState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'

import {
  saveEventsSettingsAction,
  seedEventsEmailStartersAction,
  type EventsAdminActionState,
} from '../actions'
import type { EventsModuleSettings } from '../types'

type Props = {
  settings: EventsModuleSettings
}

const initial: EventsAdminActionState = {}

export function EventsSettingsForm({ settings }: Props) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(saveEventsSettingsAction, initial)
  const [seedState, seedAction, seedPending] = useActionState(
    seedEventsEmailStartersAction,
    initial,
  )

  useNotifySavedOnOk(state)
  useNotifySavedOnOk(seedState)

  useEffect(() => {
    if (state.ok || seedState.ok) router.refresh()
  }, [state, seedState, router])

  const busy = pending || seedPending

  return (
    <div className="admin-settings-mosaic sf-events-settings">
      <form action={formAction} className="page-settings-panel">
        <header className="page-settings-panel-head">
          <h3>Defaults</h3>
        </header>
        <div className="page-settings-panel-body">
          <label className="settings-field">
            <span>Default timezone</span>
            <input
              type="text"
              name="defaultTimezone"
              defaultValue={settings.defaultTimezone}
              maxLength={80}
              autoComplete="off"
              placeholder="UTC"
              disabled={busy}
            />
            <span className="settings-hint">
              IANA id (e.g. <code>Europe/Budapest</code>). Applied to new events in the admin
              form.
            </span>
          </label>
          <label className="settings-field settings-flag">
            <input
              type="checkbox"
              name="preventDuplicate"
              value="1"
              defaultChecked={settings.preventDuplicate !== false}
              disabled={busy}
            />
            <span>Prevent duplicate registration (same email per event)</span>
          </label>
          <div className="page-settings-actions">
            <button
              type="submit"
              className="gantry-toolbar-btn gantry-toolbar-btn-save"
              disabled={busy}
            >
              {pending ? 'Saving…' : 'Save settings'}
            </button>
          </div>
          {state.error ? (
            <p className="admin-inline-error" role="alert">
              {state.error}
            </p>
          ) : null}
          {state.ok && state.message ? (
            <p className="admin-inline-ok" role="status">
              {state.message}
            </p>
          ) : null}
        </div>
      </form>

      <section className="page-settings-panel">
        <header className="page-settings-panel-head">
          <h3>Registration form</h3>
        </header>
        <div className="page-settings-panel-body">
          <p className="settings-hint">
            Field definitions live in{' '}
            <Link href="/admin/forms">Forms</Link> — not here. Events uses the shared{' '}
            <code>event-registration</code> definition; at render time it injects{' '}
            <code>event_id</code>, ticket tiers, and terms checkbox when configured.
          </p>
          <div className="page-settings-actions">
            <Link
              href="/admin/forms/event-registration"
              className="gantry-toolbar-btn gantry-toolbar-btn-muted"
            >
              Edit registration form
            </Link>
          </div>
        </div>
      </section>

      <section className="page-settings-panel">
        <header className="page-settings-panel-head">
          <h3>Registration email</h3>
        </header>
        <div className="page-settings-panel-body">
          <p className="settings-hint">
            Seeds Email Manager template + rule for{' '}
            <code>product:events/registered</code>, and ensures the shared{' '}
            <code>event-registration</code> Form definition exists.
          </p>
          <div className="page-settings-actions">
            <form action={seedAction}>
              <button
                type="submit"
                className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                disabled={busy}
              >
                {seedPending ? 'Seeding…' : 'Seed registration email + form'}
              </button>
            </form>
          </div>
          {seedState.error ? (
            <p className="admin-inline-error" role="alert">
              {seedState.error}
            </p>
          ) : null}
          {seedState.ok && seedState.message ? (
            <p className="admin-inline-ok" role="status">
              {seedState.message}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  )
}
