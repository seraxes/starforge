'use client'

import React, { useActionState, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import {
  updateSiteSettingsAction,
  type SettingsActionState,
} from '@/core/settings/actions'
import type { FeatureFlags, ModuleToggleMap } from '@/core/settings/defaults'
import { resolveModuleInfoSettingsHref } from '@/core/settings/module-info-settings'
import type { ModuleCatalogItem, ModuleToggleKind } from '@/core/settings/module-toggles'

import { useNotifySavedOnOk } from '../admin-toast'
import { useAutosaveForm } from '../use-autosave-form'
import {
  applyModulesActionToggles,
  moduleTogglesSignature,
  resolveModuleToggleChecked,
} from './settings-modules-state'

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
        const checked = resolveModuleToggleChecked(item, moduleToggles, features)
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
  const router = useRouter()
  const [state, formAction, pending] = useActionState(updateSiteSettingsAction, initialState)
  useNotifySavedOnOk(state, { toastErrors: true })
  const { formRef, discreteAutosaveProps, saveNow } = useAutosaveForm()

  // Live effective toggles: server props first, then action-returned map after save
  // (deferred revalidate may leave props stale; requires closure must remount).
  const [liveToggles, setLiveToggles] = useState(moduleToggles)
  const [liveFeatures, setLiveFeatures] = useState(features)
  const propsSig = moduleTogglesSignature(moduleToggles)
  const [propsEpoch, setPropsEpoch] = useState(propsSig)
  if (propsSig !== propsEpoch) {
    setPropsEpoch(propsSig)
    setLiveToggles(moduleToggles)
    setLiveFeatures(features)
  }

  const liveRef = useRef({ moduleToggles: liveToggles, features: liveFeatures })
  liveRef.current = { moduleToggles: liveToggles, features: liveFeatures }

  const [errorEpoch, setErrorEpoch] = useState(0)
  useEffect(() => {
    if (pending) return
    if (state.error) {
      setErrorEpoch((n) => n + 1)
      return
    }
    // Action carries effective toggles (incl. requires). Props may stay stale under deferred revalidate.
    const applied = applyModulesActionToggles(state, liveRef.current)
    if (!applied) return
    setLiveToggles(applied.moduleToggles)
    setLiveFeatures(applied.features)
    // Rebuild admin layout so disabled packs leave the left sidebar immediately.
    router.refresh()
  }, [pending, state, router])

  const togglesSig = moduleTogglesSignature(liveToggles)

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
              moduleToggles={liveToggles}
              features={liveFeatures}
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
