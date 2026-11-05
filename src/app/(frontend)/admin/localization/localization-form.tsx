'use client'

import React, { useActionState } from 'react'
import Link from 'next/link'

import { LOCALE_LABELS, LOCALES, type AppLocale } from '@/core/i18n/locales'
import {
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
  const [state, formAction, pending] = useActionState(
    updateLocalizationAction,
    initialState,
  )
  useNotifySavedOnOk(state, { toastErrors: true })
  const { formRef, discreteAutosaveProps } = useAutosaveForm()

  const enabled = new Set(settings.localesEnabled)

  return (
    <form
      ref={formRef}
      action={formAction}
      className="settings-form settings-form-wide"
    >
      <div className="admin-settings-mosaic">
        <fieldset className="settings-fieldset">
          <legend>Enabled locales</legend>
          <p className="settings-hint">
            Public URLs use a locale prefix (<code>/en/…</code>, <code>/hu/…</code>). Core
            admin (<code>/admin</code>) and Payload (<code>/cms</code>) stay unprefixed.
            Catalog comes from the Core i18n port; limiting which prefixes negotiate at the
            edge lands in a later phase — this list is the site’s intended enable set.
          </p>
          {LOCALES.map((code: AppLocale) => (
            <label key={code} className="settings-flag">
              <input
                type="checkbox"
                name="localesEnabled"
                value={code}
                defaultChecked={enabled.has(code)}
                disabled={pending}
                {...discreteAutosaveProps}
              />
              <span>
                <strong>
                  {LOCALE_LABELS[code]} ({code})
                </strong>
              </span>
            </label>
          ))}
        </fieldset>

        <fieldset className="settings-fieldset">
          <legend>Default locale</legend>
          <p className="settings-hint">
            Used as the platform default when negotiating public routes and as the content
            fallback target when fallback is on. Must stay in the enabled list.
          </p>
          <label className="settings-field">
            <span>Default</span>
            <select
              name="defaultLocale"
              defaultValue={settings.defaultLocale}
              disabled={pending}
              {...discreteAutosaveProps}
            >
              {LOCALES.map((code: AppLocale) => (
                <option key={code} value={code}>
                  {LOCALE_LABELS[code]} ({code})
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
              disabled={pending}
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
