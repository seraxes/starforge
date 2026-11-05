'use client'

import React, { useActionState, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { isBootstrapLocale } from '@/core/i18n/locales'
import {
  removeLocaleFromCatalogAction,
  updateLocalizationAction,
  type LocalizationActionState,
} from '@/core/localization/actions'
import type { LocalizationSettings } from '@/core/localization/types'

import { useNotifySavedOnOk } from '../admin-toast'
import { useAutosaveForm } from '../use-autosave-form'

type Props = {
  settings: LocalizationSettings
}

const initialState: LocalizationActionState = {}

export function LocalizationForm({ settings }: Props) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(
    updateLocalizationAction,
    initialState,
  )
  const [removeState, removeAction, removePending] = useActionState(
    removeLocaleFromCatalogAction,
    initialState,
  )
  useNotifySavedOnOk(state, { toastErrors: true })
  useNotifySavedOnOk(removeState, { toastErrors: true })
  const { formRef, discreteAutosaveProps } = useAutosaveForm()

  const [catalog, setCatalog] = useState(settings.localeCatalog)
  const enabled = useMemo(() => new Set(settings.localesEnabled), [settings.localesEnabled])

  useEffect(() => {
    setCatalog(settings.localeCatalog)
  }, [settings.localeCatalog])

  useEffect(() => {
    if (state.ok || removeState.ok) {
      router.refresh()
    }
  }, [state.ok, state.message, removeState.ok, removeState.message, router])

  const busy = pending || removePending

  return (
    <div className="admin-settings-mosaic">
      <form
        ref={formRef}
        action={formAction}
        className="settings-form settings-form-wide"
      >
        <fieldset className="settings-fieldset">
          <legend>Locale catalog</legend>
          <p className="settings-hint">
            Codes become public URL prefixes (<code>/en/…</code>, <code>/de/…</code>). Core
            admin (<code>/admin</code>) and Payload (<code>/cms</code>) stay unprefixed.
            Bootstrap <code>en</code> / <code>hu</code> always stay in the catalog; you can
            add more language tags below.
          </p>

          <div className="sf-locale-catalog-table">
            {catalog.map((entry, index) => (
              <div key={entry.code} className="sf-locale-catalog-row">
                <input type="hidden" name="catalogCode" value={entry.code} />
                <label className="settings-flag">
                  <input
                    type="checkbox"
                    name="localesEnabled"
                    value={entry.code}
                    defaultChecked={enabled.has(entry.code)}
                    disabled={busy}
                    {...discreteAutosaveProps}
                  />
                  <span>
                    <strong>
                      <code>{entry.code}</code>
                    </strong>
                    {isBootstrapLocale(entry.code) ? (
                      <span className="settings-flag-desc"> bootstrap</span>
                    ) : null}
                  </span>
                </label>
                <label className="settings-field sf-locale-catalog-label">
                  <span className="visually-hidden">Label for {entry.code}</span>
                  <input
                    type="text"
                    name="catalogLabel"
                    defaultValue={entry.label}
                    maxLength={64}
                    disabled={busy}
                    aria-label={`Label for ${entry.code}`}
                    onChange={(e) => {
                      const value = e.target.value
                      setCatalog((prev) =>
                        prev.map((row, i) =>
                          i === index ? { ...row, label: value } : row,
                        ),
                      )
                    }}
                  />
                </label>
              </div>
            ))}
          </div>
        </fieldset>

        <fieldset className="settings-fieldset">
          <legend>Add locale</legend>
          <p className="settings-hint">
            Use a BCP-47-ish code (<code>de</code>, <code>fr</code>, <code>en-US</code>,{' '}
            <code>pt-BR</code>). Public routing, the locale switcher, nav prefixes, and
            hreflang pick up new codes immediately. Payload CMS locales in{' '}
            <code>payload.config.ts</code> stay code-bootstrapped from <code>en</code>/
            <code>hu</code> — admin-added codes do <strong>not</strong> hot-reload into{' '}
            <code>/cms</code> until that config is updated and the app restarts.
          </p>
          <div className="sf-locale-add-row">
            <label className="settings-field">
              <span>Code</span>
              <input
                type="text"
                name="addLocaleCode"
                placeholder="de"
                maxLength={16}
                autoComplete="off"
                disabled={busy}
                pattern="[a-z]{2,3}(-[A-Za-z0-9]{2,8})*"
              />
            </label>
            <label className="settings-field">
              <span>Label</span>
              <input
                type="text"
                name="addLocaleLabel"
                placeholder="Deutsch"
                maxLength={64}
                disabled={busy}
              />
            </label>
            <label className="settings-flag">
              <input
                type="checkbox"
                name="addLocaleEnable"
                defaultChecked
                disabled={busy}
              />
              <span>Enable after add</span>
            </label>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              Add locale
            </button>
          </div>
        </fieldset>

        <fieldset className="settings-fieldset">
          <legend>Default locale</legend>
          <p className="settings-hint">
            Used when negotiating public routes and as the content fallback target when
            fallback is on. Must stay in the enabled list.
          </p>
          <label className="settings-field">
            <span>Default</span>
            <select
              name="defaultLocale"
              defaultValue={settings.defaultLocale}
              disabled={busy}
              {...discreteAutosaveProps}
            >
              {catalog.map((entry) => (
                <option key={entry.code} value={entry.code}>
                  {entry.label} ({entry.code})
                </option>
              ))}
            </select>
          </label>
        </fieldset>

        <fieldset className="settings-fieldset">
          <legend>Fallback</legend>
          <p className="settings-hint">
            When on, missing translations fall back to the default locale. Payload’s{' '}
            <code>localization.fallback</code> in <code>payload.config.ts</code> stays
            code-configured for now (restart / redeploy to change runtime CMS fallback). This
            toggle stores the Site Settings intent for a later sync pass.
          </p>
          <label className="settings-flag">
            <input
              type="checkbox"
              name="localeFallback"
              defaultChecked={settings.localeFallback}
              disabled={busy}
              {...discreteAutosaveProps}
            />
            <span>
              <strong>Fall back to default locale</strong>
              <span className="settings-flag-desc">
                Offline / SEO / cookies / email stay under{' '}
                <Link href="/admin/site-chrome">Chrome</Link>.
              </span>
            </span>
          </label>
        </fieldset>

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
        {pending ? <p className="field-hint">Saving…</p> : null}
      </form>

      {catalog.some((e) => !isBootstrapLocale(e.code)) ? (
        <fieldset className="settings-fieldset">
          <legend>Remove custom locale</legend>
          <p className="settings-hint">
            Bootstrap <code>en</code>/<code>hu</code> cannot be removed. You cannot remove
            the last enabled locale — enable another first. Removing a locale drops it from
            the public catalog (routing / switcher / hreflang).
          </p>
          <ul className="sf-locale-remove-list">
            {catalog
              .filter((e) => !isBootstrapLocale(e.code))
              .map((entry) => (
                <li key={entry.code}>
                  <form action={removeAction} className="sf-locale-remove-row">
                    <input type="hidden" name="removeLocaleCode" value={entry.code} />
                    <span>
                      <strong>{entry.label}</strong> (<code>{entry.code}</code>)
                    </span>
                    <button
                      type="submit"
                      className="btn btn-danger"
                      disabled={busy}
                      onClick={(e) => {
                        if (
                          !window.confirm(
                            `Remove locale ${entry.code} from the catalog?`,
                          )
                        ) {
                          e.preventDefault()
                        }
                      }}
                    >
                      Remove
                    </button>
                  </form>
                </li>
              ))}
          </ul>
          {removeState.error ? (
            <p className="admin-inline-error" role="alert">
              {removeState.error}
            </p>
          ) : null}
          {removeState.ok && removeState.message ? (
            <p className="admin-inline-ok" role="status">
              {removeState.message}
            </p>
          ) : null}
        </fieldset>
      ) : null}
    </div>
  )
}
