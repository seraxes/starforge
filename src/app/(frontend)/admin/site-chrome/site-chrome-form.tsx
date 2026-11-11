'use client'

import React, { useActionState, useEffect, useRef, useState } from 'react'
import Link from 'next/link'

import type { SiteChromeConsentLocaleMaps } from '@/core/i18n/content-locales'
import type { ContentLocaleOption, LocaleTextMap } from '@/core/i18n/locale-text'
import { LocaleInput } from '@/core/localization/LocaleInput'
import {
  updateSiteChromeAction,
  updateSiteOfflineAction,
  type SiteChromeActionState,
} from '@/core/site-chrome/actions'
import { MAIL_PROVIDERS } from '@/core/site-chrome/defaults'
import type { SiteChromeDocument } from '@/core/site-chrome/types'

import { useAdminAutosaveDebounceMs } from '../admin-autosave-context'
import { useNotifySavedOnOk } from '../admin-toast'
import { useAutosaveForm } from '../use-autosave-form'

type OutlineOption = {
  id: string
  label: string
}

type Props = {
  chrome: SiteChromeDocument & SiteChromeConsentLocaleMaps
  outlines: OutlineOption[]
  locales: ContentLocaleOption[]
}

const initialState: SiteChromeActionState = {}

export function SiteChromeForm({ chrome, outlines, locales }: Props) {
  const [state, formAction, pending] = useActionState(updateSiteChromeAction, initialState)
  const [offlineState, offlineFormAction, offlinePending] = useActionState(
    updateSiteOfflineAction,
    initialState,
  )
  useNotifySavedOnOk(state, { toastErrors: true })
  useNotifySavedOnOk(offlineState, { toastErrors: true })
  const { formRef, textAutosaveProps, discreteAutosaveProps, saveDebounced, flushOnBlur } =
    useAutosaveForm()
  const debounceMs = useAdminAutosaveDebounceMs()
  const defaultCode = locales.find((locale) => locale.isDefault)?.code ?? locales[0]?.code ?? ''

  const [offlineEnabled, setOfflineEnabled] = useState(chrome.offlineEnabled)
  const [offlineLayoutId, setOfflineLayoutId] = useState(chrome.offlineLayoutId)
  const [offlineMessage, setOfflineMessage] = useState(chrome.offlineMessage)
  const offlineRef = useRef({
    enabled: chrome.offlineEnabled,
    layoutId: chrome.offlineLayoutId,
    message: chrome.offlineMessage,
  })
  const offlineTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (offlineTimer.current) clearTimeout(offlineTimer.current)
    }
  }, [])

  /**
   * Submit offline fields ourselves. requestSubmit + disabled={pending} drops the
   * checkbox from FormData (disabled controls are omitted), so the server saved off.
   */
  function saveOffline(patch: { enabled?: boolean; layoutId?: string; message?: string }) {
    const next = { ...offlineRef.current, ...patch }
    offlineRef.current = next
    setOfflineEnabled(next.enabled)
    setOfflineLayoutId(next.layoutId)
    setOfflineMessage(next.message)
    const fd = new FormData()
    fd.set('offlineEnabled', next.enabled ? 'on' : '0')
    fd.set('offlineLayoutId', next.layoutId)
    fd.set('offlineMessage', next.message)
    offlineFormAction(fd)
  }

  const [consentMessage, setConsentMessage] = useState(chrome.consentMessage)
  const [consentPrivacyUrl, setConsentPrivacyUrl] = useState(chrome.consentPrivacyUrl)
  const [consentPrivacyLinkLabel, setConsentPrivacyLinkLabel] = useState(
    chrome.consentPrivacyLinkLabel,
  )
  const [consentMessageLocales, setConsentMessageLocales] = useState<LocaleTextMap>(
    chrome.consentMessageLocales,
  )
  const [consentPrivacyUrlLocales, setConsentPrivacyUrlLocales] = useState<LocaleTextMap>(
    chrome.consentPrivacyUrlLocales,
  )
  const [consentPrivacyLinkLabelLocales, setConsentPrivacyLinkLabelLocales] =
    useState<LocaleTextMap>(chrome.consentPrivacyLinkLabelLocales)

  return (
    <div className="settings-form settings-form-wide">
      <div className="admin-settings-mosaic">
      <form style={{ display: 'contents' }} onSubmit={(event) => event.preventDefault()}>
      <fieldset className="settings-fieldset">
        <legend>Site offline</legend>
        <p className="settings-hint">
          When offline, visitors see the message below inside the selected outline (active skin).
          App admins can still open the public site and <Link href="/admin">Starforge admin</Link>.
          Login stays available so admins can sign in. Edit the outline under{' '}
          <Link href="/admin/layouts">Layouts</Link>.
        </p>
        <label className="settings-flag">
          <input
            type="checkbox"
            name="offlineEnabled"
            checked={offlineEnabled}
            onChange={(event) => saveOffline({ enabled: event.target.checked })}
          />
          <span>
            <strong>Take site offline</strong>
            <span className="settings-flag-desc">
              Public pages show the offline screen until this is turned off.
            </span>
          </span>
        </label>
        <label className="settings-field">
          <span>Offline outline</span>
          <select
            name="offlineLayoutId"
            value={offlineLayoutId}
            onChange={(event) => saveOffline({ layoutId: event.target.value })}
          >
            {outlines.map((outline) => (
              <option key={outline.id} value={outline.id}>
                {outline.label} ({outline.id})
              </option>
            ))}
          </select>
        </label>
        <label className="settings-field">
          <span>Offline message</span>
          <textarea
            name="offlineMessage"
            rows={3}
            value={offlineMessage}
            autoComplete="off"
            onChange={(event) => {
              const message = event.target.value
              setOfflineMessage(message)
              offlineRef.current = { ...offlineRef.current, message }
              if (offlineTimer.current) clearTimeout(offlineTimer.current)
              offlineTimer.current = setTimeout(() => {
                offlineTimer.current = null
                saveOffline({ message })
              }, debounceMs)
            }}
          />
        </label>
      </fieldset>
      </form>

      <form ref={formRef} action={formAction} style={{ display: 'contents' }}>
      <fieldset className="settings-fieldset">
        <legend>Outbound email</legend>
        <p className="settings-hint">
          Platform Mailer for Forms notify (and later forgot-password). Choose enable + provider +
          From here. SMTP credentials (<code>SMTP_HOST</code>, <code>SMTP_USER</code>,{' '}
          <code>SMTP_PASS</code>, …) and <code>RESEND_API_KEY</code> stay in env — gated{' '}
          <Link href="/admin/site-chrome/environment">Environment</Link>, never this form or the
          database. Console logs locally with no network send.
        </p>
        <label className="settings-flag">
          <input
            type="checkbox"
            name="emailEnabled"
            defaultChecked={chrome.emailEnabled}
            disabled={pending}
            {...discreteAutosaveProps}
          />
          <span>
            <strong>Enable outbound email</strong>
            <span className="settings-flag-desc">
              When off, Form notify intents are skipped (submissions still save).
            </span>
          </span>
        </label>
        <label className="settings-field">
          <span>Provider</span>
          <select
            name="emailProvider"
            defaultValue={chrome.emailProvider}
            disabled={pending}
            {...discreteAutosaveProps}
          >
            {MAIL_PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="settings-field">
          <span>Default From address</span>
          <input
            type="email"
            name="emailFrom"
            defaultValue={chrome.emailFrom}
            autoComplete="off"
            placeholder="noreply@example.com"
            disabled={pending}
            {...textAutosaveProps}
          />
          <span className="settings-flag-desc">
            Forms Settings From overrides this when set. Empty → optional{' '}
            <code>STARFORGE_MAIL_FROM</code> env.
          </span>
        </label>
      </fieldset>

      <fieldset className="settings-fieldset">
        <legend>Localization</legend>
        <p className="settings-hint">
          Enabled locales, default locale, and fallback moved to the dedicated{' '}
          <Link href="/admin/localization">Localization</Link> admin page (not edited here).
        </p>
      </fieldset>

      <fieldset className="settings-fieldset">
        <legend>Site metadata</legend>
        <p className="settings-hint">
          Defaults for the public document title, description, and Open Graph image. Per-page
          overrides stay under Layouts → Page settings.
        </p>
        <label className="settings-field">
          <span>Site name</span>
          <input
            type="text"
            name="siteName"
            defaultValue={chrome.siteName}
            required
            autoComplete="off"
            disabled={pending}
            {...textAutosaveProps}
          />
        </label>
        <label className="settings-field">
          <span>Default description</span>
          <textarea
            name="defaultDescription"
            rows={2}
            defaultValue={chrome.defaultDescription}
            autoComplete="off"
            placeholder="Short site summary for search / social"
            disabled={pending}
            {...textAutosaveProps}
          />
        </label>
        <label className="settings-field">
          <span>Default OG image URL</span>
          <input
            type="text"
            name="defaultOgImage"
            defaultValue={chrome.defaultOgImage}
            autoComplete="off"
            placeholder="/media/… or https://…"
            disabled={pending}
            {...textAutosaveProps}
          />
        </label>
      </fieldset>

      <fieldset className="settings-fieldset">
        <legend>Robots</legend>
        <p className="settings-hint">
          Default robots meta on public pages, plus the body served at{' '}
          <Link href="/robots.txt">/robots.txt</Link>.
        </p>
        <label className="settings-field">
          <span>Robots meta</span>
          <input
            type="text"
            name="robotsMeta"
            defaultValue={chrome.robotsMeta}
            autoComplete="off"
            placeholder="index, follow"
            disabled={pending}
            {...textAutosaveProps}
          />
        </label>
        <label className="settings-field">
          <span>robots.txt</span>
          <textarea
            name="robotsTxt"
            rows={6}
            defaultValue={chrome.robotsTxt}
            spellCheck={false}
            className="settings-field-mono"
            disabled={pending}
            {...textAutosaveProps}
          />
        </label>
      </fieldset>

      <fieldset className="settings-fieldset">
        <legend>Content rights</legend>
        <p className="settings-hint">
          Copyright / rights statement. Used as the Copyright particle fallback when that particle’s
          text is empty.
        </p>
        <label className="settings-field">
          <span>Rights statement</span>
          <textarea
            name="contentRights"
            rows={2}
            defaultValue={chrome.contentRights}
            autoComplete="off"
            placeholder="All rights reserved."
            disabled={pending}
            {...textAutosaveProps}
          />
        </label>
      </fieldset>

      <fieldset className="settings-fieldset">
        <legend>Cookie domain and path</legend>
        <p className="settings-hint">
          Session cookie scope for Better Auth. Leave domain empty for host-only cookies. Path
          defaults to <code>/</code>. The consent preference cookie (<code>sf-consent</code>) reuses
          the same path/domain when the Consent module is on.
        </p>
        <label className="settings-field">
          <span>Cookie domain</span>
          <input
            type="text"
            name="cookieDomain"
            defaultValue={chrome.cookieDomain}
            autoComplete="off"
            placeholder="(empty = host-only)"
            disabled={pending}
            {...textAutosaveProps}
          />
        </label>
        <label className="settings-field">
          <span>Cookie path</span>
          <input
            type="text"
            name="cookiePath"
            defaultValue={chrome.cookiePath}
            autoComplete="off"
            placeholder="/"
            disabled={pending}
            {...textAutosaveProps}
          />
        </label>
      </fieldset>

      <fieldset className="settings-fieldset">
        <legend>Consent banner</legend>
        <p className="settings-hint">
          Policy copy for the public cookie banner (<code>product:consent</code>). Per-locale
          values sync to{' '}
          <code>data/content-locales/{'{locale}'}/chrome/consent.json</code> (also editable under{' '}
          <Link href="/admin/localization">Localization</Link>). Turn the module on/off under{' '}
          <Link href="/admin/settings">Settings → Modules</Link>. Visitor choices stay in the{' '}
          <code>sf-consent</code> cookie (no database table). Analytics scripts load only after the
          visitor accepts analytics.
        </p>
        <input type="hidden" name="consentMessage" value={consentMessage} />
        <input type="hidden" name="consentPrivacyUrl" value={consentPrivacyUrl} />
        <input type="hidden" name="consentPrivacyLinkLabel" value={consentPrivacyLinkLabel} />
        <input
          type="hidden"
          name="consentMessageLocales"
          value={JSON.stringify(consentMessageLocales)}
        />
        <input
          type="hidden"
          name="consentPrivacyUrlLocales"
          value={JSON.stringify(consentPrivacyUrlLocales)}
        />
        <input
          type="hidden"
          name="consentPrivacyLinkLabelLocales"
          value={JSON.stringify(consentPrivacyLinkLabelLocales)}
        />
        <LocaleInput
          locales={locales}
          label="Banner message"
          multiline
          rows={3}
          values={{
            ...consentMessageLocales,
            ...(defaultCode ? { [defaultCode]: consentMessage } : {}),
          }}
          onChange={(code, value) => {
            setConsentMessageLocales((prev) => ({ ...prev, [code]: value }))
            if (code === defaultCode) setConsentMessage(value)
            saveDebounced()
          }}
          onBlur={flushOnBlur}
        />
        <LocaleInput
          locales={locales}
          label="Privacy policy URL"
          placeholder="/privacy or https://…"
          values={{
            ...consentPrivacyUrlLocales,
            ...(defaultCode ? { [defaultCode]: consentPrivacyUrl } : {}),
          }}
          onChange={(code, value) => {
            setConsentPrivacyUrlLocales((prev) => ({ ...prev, [code]: value }))
            if (code === defaultCode) setConsentPrivacyUrl(value)
            saveDebounced()
          }}
          onBlur={flushOnBlur}
        />
        <LocaleInput
          locales={locales}
          label="Privacy link label"
          placeholder="Privacy policy"
          values={{
            ...consentPrivacyLinkLabelLocales,
            ...(defaultCode ? { [defaultCode]: consentPrivacyLinkLabel } : {}),
          }}
          onChange={(code, value) => {
            setConsentPrivacyLinkLabelLocales((prev) => ({ ...prev, [code]: value }))
            if (code === defaultCode) setConsentPrivacyLinkLabel(value)
            saveDebounced()
          }}
          onBlur={flushOnBlur}
        />
      </fieldset>
      </form>
      </div>

      {offlineState.error ? (
        <p className="admin-inline-error" role="alert">
          {offlineState.error}
        </p>
      ) : null}
      {state.error ? (
        <p className="admin-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
      {offlinePending || pending ? <p className="field-hint">Saving…</p> : null}
    </div>
  )
}
