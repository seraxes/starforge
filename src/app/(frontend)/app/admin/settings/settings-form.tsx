'use client'

import React, { useActionState, useState } from 'react'

import {
  updateSiteSettingsAction,
  type SettingsActionState,
} from '@/core/settings/actions'
import type { FeatureFlags, ModuleToggleMap, NavItem } from '@/core/settings/defaults'
import type { ModuleCatalogItem } from '@/core/settings/module-toggles'

type Props = {
  siteName: string
  primaryNav: NavItem[]
  features: FeatureFlags
  moduleCatalog: ModuleCatalogItem[]
  moduleToggles: ModuleToggleMap
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

function resolveChecked(item: ModuleCatalogItem, toggles: ModuleToggleMap, masterModules: boolean) {
  if (item.required) return true
  if (typeof toggles[item.id] === 'boolean') return toggles[item.id]!
  if (!item.defaultEnabled) return masterModules
  return true
}

export function SettingsForm({
  siteName,
  primaryNav,
  features,
  moduleCatalog,
  moduleToggles,
}: Props) {
  const [state, formAction, pending] = useActionState(updateSiteSettingsAction, initialState)
  const [navRows, setNavRows] = useState<NavItem[]>(
    primaryNav.length > 0 ? primaryNav : [{ label: '', href: '' }],
  )

  const particles = moduleCatalog.filter((m) => m.kind === 'particle')
  const atoms = moduleCatalog.filter((m) => m.kind === 'atom')

  return (
    <form action={formAction} className="settings-form settings-form-wide">
      <fieldset className="settings-fieldset">
        <legend>Site chrome</legend>
        <p className="settings-hint">
          Also editable in Payload <code>/admin</code> → Globals → Site settings. Saving here stores
          nav rows as custom paths/URLs. Prefer Payload’s <strong>CMS page</strong> link type so
          header links stay tied to page slugs.
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
          name="featureDraftPreview"
          label="Draft preview"
          description="When on, users with CMS access can open /preview/{slug} to see unpublished drafts. Public /{slug} stays published-only."
          checked={features.draftPreview}
        />
      </fieldset>

      <fieldset className="settings-fieldset settings-modules">
        <legend>Modules</legend>
        <p className="settings-hint">
          Installed / registered particles and Page Settings atoms. Off = hidden from the layout
          palette and skipped on the public site (and atom injectors). Required chrome stays on.
          Package uninstall / GitHub Packages sync is a later phase.
        </p>

        <h3 className="settings-modules-subhead">Layout particles</h3>
        <ul className="settings-modules-list">
          {particles.map((item) => {
            const checked = resolveChecked(item, moduleToggles, features.modules)
            return (
              <li key={item.id} className="settings-modules-row">
                <input type="hidden" name="moduleToggleId" value={item.id} />
                <label className="settings-modules-toggle">
                  <input
                    type="checkbox"
                    name="moduleToggleEnabled"
                    value={item.id}
                    defaultChecked={checked}
                    disabled={item.required}
                  />
                  <span>
                    <strong>{item.label}</strong>
                    {item.required ? (
                      <span className="settings-modules-badge">Required</span>
                    ) : (
                      <span className="settings-modules-badge settings-modules-badge-muted">
                        Particle
                      </span>
                    )}
                    <code className="settings-modules-id">{item.id}</code>
                    <span className="settings-flag-desc">{item.description}</span>
                  </span>
                </label>
              </li>
            )
          })}
        </ul>

        <h3 className="settings-modules-subhead">Page Settings atoms</h3>
        <ul className="settings-modules-list">
          {atoms.map((item) => {
            const checked = resolveChecked(item, moduleToggles, features.modules)
            return (
              <li key={item.id} className="settings-modules-row">
                <input type="hidden" name="moduleToggleId" value={item.id} />
                <label className="settings-modules-toggle">
                  <input
                    type="checkbox"
                    name="moduleToggleEnabled"
                    value={item.id}
                    defaultChecked={checked}
                  />
                  <span>
                    <strong>{item.label}</strong>
                    <span className="settings-modules-badge settings-modules-badge-muted">Atom</span>
                    <code className="settings-modules-id">{item.id}</code>
                    <span className="settings-flag-desc">{item.description}</span>
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
        {moduleCatalog.length === 0 ? (
          <p className="settings-hint">No modules registered yet.</p>
        ) : null}
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
