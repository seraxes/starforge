'use client'

import React, { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'
import { MediaPicker, type MediaPickerValue } from '@/modules/media/api'

import { savePwaSettingsAction, type PwaAdminActionState } from '../actions'
import { PWA_DISPLAY_MODES, type PwaModuleSettings } from '../types'

type Props = {
  settings: PwaModuleSettings
  hasChromeIcons: boolean
}

const initial: PwaAdminActionState = {}

export function PwaSettingsForm({ settings, hasChromeIcons }: Props) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(savePwaSettingsAction, initial)
  const [icon, setIcon] = useState<MediaPickerValue>({
    mediaId: settings.iconMediaId,
    url: settings.iconUrl,
    alt: '',
  })

  useNotifySavedOnOk(state)

  useEffect(() => {
    if (state.ok) router.refresh()
  }, [state, router])

  const iconReady = Boolean(icon.mediaId?.trim() || icon.url?.trim() || hasChromeIcons)

  return (
    <form action={formAction} className="page-settings-panel">
      <header className="page-settings-panel-head">
        <h3>Installability</h3>
      </header>
      <div className="page-settings-panel-body">
        <p className="settings-hint">
          Site name comes from Site Chrome. Icons fall back to Page Settings favicon /
          apple-touch-icon when no override is set. Module on/off lives under Settings →
          Modules.
        </p>

        <label className="settings-field">
          <span>Short name</span>
          <input
            type="text"
            name="shortName"
            defaultValue={settings.shortName}
            maxLength={32}
            autoComplete="off"
            placeholder="Uses site name when empty"
            disabled={pending}
          />
          <span className="settings-hint">Shown under the home-screen icon (max 32 chars).</span>
        </label>

        <label className="settings-field">
          <span>Theme color</span>
          <input
            type="color"
            name="themeColor"
            defaultValue={settings.themeColor}
            disabled={pending}
          />
        </label>

        <label className="settings-field">
          <span>Background color</span>
          <input
            type="color"
            name="backgroundColor"
            defaultValue={settings.backgroundColor}
            disabled={pending}
          />
        </label>

        <label className="settings-field">
          <span>Display</span>
          <select name="display" defaultValue={settings.display} disabled={pending}>
            {PWA_DISPLAY_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>
        </label>

        <label className="settings-field">
          <span>Start URL</span>
          <input
            type="text"
            name="startUrl"
            defaultValue={settings.startUrl}
            maxLength={200}
            autoComplete="off"
            placeholder="/"
            disabled={pending}
          />
          <span className="settings-hint">
            Relative path. Locale prefix is applied automatically when the path is{' '}
            <code>/</code> or site-relative.
          </span>
        </label>

        <div className="settings-field">
          <MediaPicker
            label="Icon override (optional)"
            value={icon}
            defaultFolder="general"
            defaultPurpose="logo"
            disabled={pending}
            allowUrlFallback
            mediaIdName="iconMediaId"
            mediaUrlName="iconUrl"
            hint="Prefer a square PNG ≥ 512×512. Shared Media library — not a second picker."
            onChange={setIcon}
          />
        </div>

        {!iconReady ? (
          <p className="admin-inline-error" role="status">
            No install icon yet — set Page Settings favicon / apple-touch-icon, or pick an
            override above (192×192 and 512×512 recommended).
          </p>
        ) : null}

        <div className="page-settings-actions">
          <button
            type="submit"
            className="gantry-toolbar-btn gantry-toolbar-btn-save"
            disabled={pending}
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
  )
}
