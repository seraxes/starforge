'use client'

import React, { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'

import {
  saveRichEditorSettingsAction,
  type RichEditorAdminActionState,
} from '../actions'
import type { RichEditorModuleSettings } from '../module-settings'

const initial: RichEditorAdminActionState = {}

type Props = {
  settings: RichEditorModuleSettings
}

function SaveButton({ pending }: { pending: boolean }) {
  return (
    <button type="submit" className="gantry-toolbar-btn gantry-toolbar-btn-save" disabled={pending}>
      {pending ? 'Saving…' : 'Save'}
    </button>
  )
}

/** Pack settings form — emoji insert global switch. Remounts when saved props change. */
export function RichEditorSettingsForm({ settings }: Props) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(saveRichEditorSettingsAction, initial)
  useNotifySavedOnOk(state)
  useEffect(() => {
    if (state.ok) router.refresh()
  }, [state.ok, router])

  const [emojiInsertEnabled, setEmojiInsertEnabled] = useState(settings.emojiInsertEnabled)

  return (
    <form action={formAction} key={String(settings.emojiInsertEnabled)}>
      <div className="page-settings-actions" style={{ marginBottom: '1rem' }}>
        <SaveButton pending={pending} />
      </div>

      <div className="admin-settings-mosaic">
        <section className="page-settings-panel">
          <header className="page-settings-panel-head">
            <h3>Emoji</h3>
          </header>
          <div className="page-settings-panel-body">
            <label className="settings-field settings-flag">
              <input
                type="checkbox"
                name="emojiInsertEnabled"
                value="1"
                checked={emojiInsertEnabled}
                disabled={pending}
                onChange={(event) => setEmojiInsertEnabled(event.target.checked)}
              />
              <span>Enable emoji insert</span>
            </label>
            <p className="settings-hint">
              Site-wide. When off, Social composers hide the emoji picker. Stored content keeps any
              emoji already typed. TipTap toolbar wiring uses the same switch later.
            </p>
          </div>
        </section>
      </div>

      <div className="page-settings-actions">
        <SaveButton pending={pending} />
      </div>
      {state.error ? (
        <p className="admin-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}
