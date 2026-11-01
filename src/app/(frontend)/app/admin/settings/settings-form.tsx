'use client'

import React, { useActionState, useState } from 'react'

import {
  updateSiteSettingsAction,
  type SettingsActionState,
} from '@/core/settings/actions'
import type { FeatureFlags, ModuleToggleMap, NavItem } from '@/core/settings/defaults'
import type { ModuleCatalogItem, ModuleToggleKind } from '@/core/settings/module-toggles'

type Props = {
  siteName: string
  primaryNav: NavItem[]
  features: FeatureFlags
  moduleCatalog: ModuleCatalogItem[]
  moduleToggles: ModuleToggleMap
}

const initialState: SettingsActionState = {}

const KIND_LABEL: Record<ModuleToggleKind, string> = {
  platform: 'Platform',
  product: 'Product',
  particle: 'Particle',
  atom: 'Atom',
}

const KIND_SECTIONS: Array<{ kind: ModuleToggleKind; title: string; hint: string }> = [
  {
    kind: 'platform',
    title: 'Platform',
    hint: 'Core stack pieces. Better Auth stays required.',
  },
  {
    kind: 'product',
    title: 'Product capabilities',
    hint: 'Layout, Page Settings, nav, Font Awesome, and former feature toggles.',
  },
  {
    kind: 'particle',
    title: 'Layout particles',
    hint: 'Palette + public layout slots. page-content is required.',
  },
  {
    kind: 'atom',
    title: 'Page Settings atoms',
    hint: 'Non-visual injectors (Analytics, Custom CSS/JS, …).',
  },
]

function resolveChecked(item: ModuleCatalogItem, toggles: ModuleToggleMap, features: FeatureFlags) {
  if (item.required) return true
  if (typeof toggles[item.id] === 'boolean') return toggles[item.id]!
  if (item.featureFlag) return Boolean(features[item.featureFlag])
  if (!item.defaultEnabled) return features.modules
  return true
}

function ModuleRows({
  items,
  moduleToggles,
  features,
}: {
  items: ModuleCatalogItem[]
  moduleToggles: ModuleToggleMap
  features: FeatureFlags
}) {
  if (items.length === 0) return <p className="settings-hint">None in this group.</p>
  return (
    <ul className="settings-modules-list">
      {items.map((item) => {
        const checked = resolveChecked(item, moduleToggles, features)
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
                    {KIND_LABEL[item.kind]}
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
  )
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

  return (
    <form action={formAction} className="settings-form settings-form-wide">
      <fieldset className="settings-fieldset">
        <legend>Site chrome</legend>
        <p className="settings-hint">
          Also editable in Payload <code>/admin</code> → Globals → Site settings. Saving here stores
          nav rows as custom paths/URLs. Prefer Payload’s <strong>CMS page</strong> link type so
          header links stay tied to page slugs. Primary nav visibility is gated under Modules →
          Primary nav.
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

      <fieldset className="settings-fieldset settings-modules">
        <legend>Modules</legend>
        <p className="settings-hint">
          All modular product pieces in this build — platform, capabilities, layout particles, and
          atoms. Each row: name, short description, on/off. Off gates admin nav/routes where safe,
          layout palette, and public render/inject. Package uninstall is a later phase.
        </p>

        {KIND_SECTIONS.map((section) => (
          <div key={section.kind} className="settings-modules-group">
            <h3 className="settings-modules-subhead">{section.title}</h3>
            <p className="settings-hint">{section.hint}</p>
            <ModuleRows
              items={moduleCatalog.filter((m) => m.kind === section.kind)}
              moduleToggles={moduleToggles}
              features={features}
            />
          </div>
        ))}
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
