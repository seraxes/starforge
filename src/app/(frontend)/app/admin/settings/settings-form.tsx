'use client'

import React, { useActionState, useState } from 'react'

import {
  updateSiteSettingsAction,
  type SettingsActionState,
} from '@/core/settings/actions'
import type { FeatureFlags, NavItem } from '@/core/settings/defaults'

type Props = {
  siteName: string
  primaryNav: NavItem[]
  features: FeatureFlags
}

const initialState: SettingsActionState = {}

function FlagRow(props: {
  name: string
  label: string
  description: string
  checked: boolean
  placeholder?: boolean
}) {
  return (
    <label className="settings-flag">
      <input type="checkbox" name={props.name} value="true" defaultChecked={props.checked} />
      <span>
        <strong>
          {props.label}
          {props.placeholder ? ' (placeholder)' : null}
        </strong>
        <span className="settings-flag-desc">{props.description}</span>
      </span>
    </label>
  )
}

export function SettingsForm({ siteName, primaryNav, features }: Props) {
  const [state, formAction, pending] = useActionState(updateSiteSettingsAction, initialState)
  const [navRows, setNavRows] = useState<NavItem[]>(
    primaryNav.length > 0 ? primaryNav : [{ label: '', href: '' }],
  )

  return (
    <form action={formAction} className="settings-form">
      <fieldset className="settings-fieldset">
        <legend>Site chrome</legend>
        <p className="settings-hint">
          Also editable in Payload <code>/admin</code> → Globals → Site settings (CMS editors).
        </p>
        <label className="settings-field">
          <span>Site name</span>
          <input
            type="text"
            name="siteName"
            defaultValue={siteName}
            required
            autoComplete="off"
          />
        </label>

        <div className="settings-nav">
          <p className="settings-nav-label">Primary nav</p>
          {navRows.map((row, index) => (
            <div className="settings-nav-row" key={`nav-${index}`}>
              <label>
                <span className="sr-only">Label {index + 1}</span>
                <input
                  type="text"
                  name="navLabel"
                  placeholder="Label"
                  value={row.label}
                  onChange={(e) => {
                    const next = [...navRows]
                    next[index] = { ...next[index], label: e.target.value }
                    setNavRows(next)
                  }}
                />
              </label>
              <label>
                <span className="sr-only">Href {index + 1}</span>
                <input
                  type="text"
                  name="navHref"
                  placeholder="/about"
                  value={row.href}
                  onChange={(e) => {
                    const next = [...navRows]
                    next[index] = { ...next[index], href: e.target.value }
                    setNavRows(next)
                  }}
                />
              </label>
              <button
                type="button"
                className="secondary"
                disabled={navRows.length <= 1}
                onClick={() => setNavRows(navRows.filter((_, i) => i !== index))}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className="secondary"
            onClick={() => setNavRows([...navRows, { label: '', href: '' }])}
          >
            Add nav item
          </button>
        </div>
      </fieldset>

      <fieldset className="settings-fieldset">
        <legend>Feature toggles</legend>
        <p className="settings-hint">
          Product capabilities — not npm packages. Off = hide UI and reject gated APIs where wired.
        </p>
        <FlagRow
          name="featureRegistration"
          label="Registration"
          description="Allow /register for new app accounts."
          checked={features.registration}
        />
        <FlagRow
          name="featureRichEditor"
          label="Rich editor"
          description="Lexical stays on Pages for now; flag reserved for a future simpler mode."
          checked={features.richEditor}
        />
        <FlagRow
          name="featurePosts"
          label="Posts"
          description="No Posts collection yet — keep off until that slice."
          checked={features.posts}
          placeholder
        />
        <FlagRow
          name="featureModules"
          label="Modules"
          description="Extension modules placeholder — keep off until the first module lands."
          checked={features.modules}
          placeholder
        />
        <FlagRow
          name="featureDraftPreview"
          label="Draft preview"
          description="Preview unpublished pages — not wired yet."
          checked={features.draftPreview}
          placeholder
        />
      </fieldset>

      {state.error ? (
        <p className="admin-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="admin-inline-ok" role="status">
          Settings saved.
        </p>
      ) : null}

      <button type="submit" className="primary" disabled={pending}>
        {pending ? 'Saving…' : 'Save settings'}
      </button>
    </form>
  )
}
