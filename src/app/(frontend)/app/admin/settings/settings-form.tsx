'use client'

import React, { useActionState } from 'react'
import Link from 'next/link'

import {
  updateSiteSettingsAction,
  type SettingsActionState,
} from '@/core/settings/actions'
import {
  ADMIN_AUTOSAVE_DEBOUNCE_MAX_MS,
  ADMIN_AUTOSAVE_DEBOUNCE_MIN_MS,
  type FeatureFlags,
  type ModuleToggleMap,
} from '@/core/settings/defaults'
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
  adminAutosaveDebounceMs: number
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
    hint: 'Layout, Page Settings, Nav manager, Font Awesome, and former feature toggles.',
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
        return (
          <li key={item.id} className="settings-modules-row">
            <input type="hidden" name="moduleToggleId" value={item.id} />
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
          </li>
        )
      })}
    </ul>
  )
}

export function SettingsForm({
  siteName,
  primaryNavMenuId,
  adminAutosaveDebounceMs,
  navMenus,
  features,
  moduleCatalog,
  moduleToggles,
}: Props) {
  const [state, formAction, pending] = useActionState(updateSiteSettingsAction, initialState)
  useNotifySavedOnOk(state, { toastErrors: true })
  const { formRef, discreteAutosaveProps, textAutosaveProps, saveNow } = useAutosaveForm()

  return (
    <form ref={formRef} action={formAction} className="settings-form settings-form-wide">
      {/* Keep siteName in the form so Modules save does not wipe Payload site name. */}
      <input type="hidden" name="siteName" value={siteName} />

      <fieldset className="settings-fieldset">
        <legend>Primary nav assignment</legend>
        <p className="settings-hint">
          Assignment only — pick which menu set the public header uses. Create and edit menus under
          the top-level <Link href="/app/admin/nav">Nav</Link> admin item. Site name / offline /
          robots / cookies: <Link href="/app/admin/site-chrome">Site Chrome</Link>. Visibility:
          Modules → Primary nav.
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
              <option value="main">Main (create under Nav)</option>
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

      <fieldset className="settings-fieldset">
        <legend>Admin autosave</legend>
        <p className="settings-hint">
          Delay before Core admin text fields patch after typing. Blur still saves immediately.
          Applies to particle cogs, Styles, Site Chrome, and other autosave forms.
        </p>
        <label className="settings-field">
          <span>Autosave debounce (ms)</span>
          <input
            type="number"
            name="adminAutosaveDebounceMs"
            defaultValue={adminAutosaveDebounceMs}
            min={ADMIN_AUTOSAVE_DEBOUNCE_MIN_MS}
            max={ADMIN_AUTOSAVE_DEBOUNCE_MAX_MS}
            step={50}
            disabled={pending}
            {...textAutosaveProps}
          />
        </label>
      </fieldset>

      <fieldset className="settings-fieldset settings-modules">
        <legend>Modules</legend>
        <p className="settings-hint">
          All modular product pieces in this build — platform, capabilities, layout particles, and
          atoms. Each row: name, short description, on/off. Off gates admin nav/routes where safe,
          layout palette, and public render/inject. Package uninstall is a later phase. Saves
          automatically.
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

      {state.error ? (
        <p className="admin-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
      {pending ? <p className="field-hint">Saving…</p> : null}
    </form>
  )
}
