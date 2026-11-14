'use client'

import React, { useActionState, useEffect, useState } from 'react'
import Link from 'next/link'

import {
  updateSiteSettingsAction,
  type SettingsActionState,
} from '@/core/settings/actions'
import type { FeatureFlags, ModuleToggleMap } from '@/core/settings/defaults'
import { resolveModuleInfoSettingsHref } from '@/core/settings/module-info-settings'
import type { ModuleCatalogItem, ModuleToggleKind } from '@/core/settings/module-toggles'

import { useNotifySavedOnOk } from '../admin-toast'
import { useAutosaveForm } from '../use-autosave-form'

type NavMenuOption = {
  id: string
  label: string
  itemCount: number
}

type Props = {
  siteName: string
  primaryNavMenuId: string
  navMenus: NavMenuOption[]
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
    hint: 'Layout, Page Settings, Navigation manager, and former feature toggles. Font Awesome config is under Layouts → Page settings; Registration policy also under Auth & registration.',
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
  onToggle,
  disabled,
}: {
  items: ModuleCatalogItem[]
  moduleToggles: ModuleToggleMap
  features: FeatureFlags
  onToggle?: () => void
  disabled?: boolean
}) {
  if (items.length === 0) return <p className="settings-hint">None in this group.</p>
  return (
    <ul className="settings-modules-list">
      {items.map((item) => {
        const checked = resolveChecked(item, moduleToggles, features)
        const infoHref = resolveModuleInfoSettingsHref(item.id, item)
        return (
          <li key={item.id} className="settings-modules-row">
            <input type="hidden" name="moduleToggleId" value={item.id} />
            <div className="settings-modules-row-main">
              <label className="settings-modules-toggle">
                <input
                  type="checkbox"
                  name="moduleToggleEnabled"
                  value={item.id}
                  defaultChecked={checked}
                  disabled={item.required || disabled}
                  onChange={onToggle}
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
              <span className="settings-modules-row-actions">
                <Link href={infoHref} className="settings-modules-info-link">
                  Info / Settings
                </Link>
              </span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/** Site Settings → Modules topic form. */
export function SettingsForm({
  siteName,
  primaryNavMenuId,
  navMenus,
  features,
  moduleCatalog,
  moduleToggles,
}: Props) {
  const [state, formAction, pending] = useActionState(updateSiteSettingsAction, initialState)
  useNotifySavedOnOk(state, { toastErrors: true })
  const { formRef, discreteAutosaveProps, saveNow } = useAutosaveForm()
  // defaultChecked only applies on mount — remount after requires closure pulls deps
  // on, or after a refused disable, so checkboxes match server toggles again.
  const togglesSig = Object.keys(moduleToggles)
    .sort()
    .map((id) => `${id}:${moduleToggles[id] ? 1 : 0}`)
    .join(',')
  const [errorEpoch, setErrorEpoch] = useState(0)
  useEffect(() => {
    if (!pending && state.error) setErrorEpoch((n) => n + 1)
  }, [pending, state.error])

  return (
    <form
      key={`${togglesSig}:${errorEpoch}`}
      ref={formRef}
      action={formAction}
      className="settings-form settings-form-wide"
    >
      {/* Keep siteName in the form so Modules save does not wipe Payload site name. */}
      <input type="hidden" name="siteName" value={siteName} />

      <div className="admin-settings-mosaic">
      <fieldset className="settings-fieldset">
        <legend>Primary nav assignment</legend>
        <p className="settings-hint">
          Assignment only — pick which menu set the public header uses. Create and edit menus under
          the top-level <Link href="/admin/nav">Navigation</Link> admin item. Site name /
          offline / robots / cookies / email:{' '}
          <Link href="/admin/site-chrome">Chrome</Link>. Visibility: Modules → Primary nav.
        </p>
        <label className="settings-field">
          <span>Primary nav menu</span>
          <select
            name="primaryNavMenuId"
            defaultValue={primaryNavMenuId}
            disabled={pending}
            {...discreteAutosaveProps}
          >
            {navMenus.length === 0 ? (
              <option value="main">Main (create under Navigation)</option>
            ) : (
              navMenus.map((menu) => (
                <option key={menu.id} value={menu.id}>
                  {menu.label} ({menu.id}) · {menu.itemCount} item
                  {menu.itemCount === 1 ? '' : 's'}
                </option>
              ))
            )}
          </select>
        </label>
      </fieldset>

      <fieldset className="settings-fieldset settings-fieldset-wide settings-modules">
        <legend>Modules</legend>
        <p className="settings-hint">
          Installed modules for this build (from <code>starforge.modules.json</code> allowlist) —
          platform, capabilities, layout particles, and atoms. Each row: name, short description,
          on/off, and <strong>Info / Settings</strong> (reuses a pack Settings menu when present;
          otherwise a Core soft stub). Off gates admin nav/routes where safe, layout palette, and
          public render/inject. To drop deadweight from the bundle, remove an id from the allowlist
          and run <code>npm run modules:generate</code>. Saves automatically. Other Settings
          topics: <Link href="/admin/settings/admin-ux">Admin UX</Link>,{' '}
          <Link href="/admin/settings/auth">Auth</Link>,{' '}
          <Link href="/admin/settings/security">Security</Link>.
        </p>

        {KIND_SECTIONS.map((section) => (
          <div key={section.kind} className="settings-modules-group">
            <h3 className="settings-modules-subhead">{section.title}</h3>
            <p className="settings-hint">{section.hint}</p>
            <ModuleRows
              items={moduleCatalog.filter((m) => m.kind === section.kind)}
              moduleToggles={moduleToggles}
              features={features}
              disabled={pending}
              onToggle={saveNow}
            />
          </div>
          ))}
        </fieldset>
      </div>

      {state.error ? (
        <p className="admin-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
      {pending ? <p className="field-hint">Saving…</p> : null}
    </form>
  )
}
