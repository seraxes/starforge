'use client'

import React, { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'

import {
  saveEventsSettingsAction,
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

  useNotifySavedOnOk(state)

  useEffect(() => {
    if (state.ok) router.refresh()
  }, [state, router])

  return (
    <form action={formAction} className="admin-settings-mosaic">
      <section className="page-settings-panel">
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
              disabled={pending}
            />
            <span className="settings-hint">
              IANA id (e.g. <code>Europe/Budapest</code>). Applied to new events in the admin
              form.
            </span>
          </label>
          <button
            type="submit"
            className="gantry-toolbar-btn gantry-toolbar-btn-save"
            disabled={pending}
          >
            {pending ? 'Saving…' : 'Save settings'}
          </button>
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
      </section>
    </form>
  )
}
