'use client'

import React, { useActionState } from 'react'
import Link from 'next/link'

import {
  updateSiteChromeAction,
  type SiteChromeActionState,
} from '@/core/site-chrome/actions'
import { CAPTCHA_PROVIDERS } from '@/core/site-chrome/defaults'
import type { SiteChromeDocument } from '@/core/site-chrome/types'

import { useNotifySavedOnOk } from '../admin-toast'
import { useAutosaveForm } from '../use-autosave-form'

type Props = {
  chrome: SiteChromeDocument
}

const initialState: SiteChromeActionState = {}

export function SiteChromeForm({ chrome }: Props) {
  const [state, formAction, pending] = useActionState(updateSiteChromeAction, initialState)
  useNotifySavedOnOk(state, { toastErrors: true })
  const { formRef, textAutosaveProps, discreteAutosaveProps } = useAutosaveForm()

  return (
    <form
      ref={formRef}
      action={formAction}
      className="settings-form settings-form-wide"
    >
      <fieldset className="settings-fieldset">
        <legend>Site offline</legend>
        <p className="settings-hint">
          When offline, visitors see the message below. App admins can still open the public site
          and <Link href="/app/admin">Starforge admin</Link>. Login stays available so admins can
          sign in.
        </p>
        <label className="settings-flag">
          <input
            type="checkbox"
            name="offlineEnabled"
            defaultChecked={chrome.offlineEnabled}
            disabled={pending}
            {...discreteAutosaveProps}
          />
          <span>
            <strong>Take site offline</strong>
            <span className="settings-flag-desc">
              Public pages show the offline screen until this is turned off.
            </span>
          </span>
        </label>
        <label className="settings-field">
          <span>Offline message</span>
          <textarea
            name="offlineMessage"
            rows={3}
            defaultValue={chrome.offlineMessage}
            autoComplete="off"
            disabled={pending}
            {...textAutosaveProps}
          />
        </label>
      </fieldset>

      <fieldset className="settings-fieldset">
        <legend>Default sitewide captcha</legend>
        <p className="settings-hint">
          Provider/enable defaults for the Core Form module when a form opts into “use site captcha
          default”. Turnstile site/secret keys stay in env (
          <code>NEXT_PUBLIC_TURNSTILE_SITE_KEY</code>, <code>TURNSTILE_SECRET_KEY</code>) — never in
          this form. reCAPTCHA / hCaptcha remain unwired.
        </p>
        <label className="settings-flag">
          <input
            type="checkbox"
            name="captchaEnabled"
            defaultChecked={chrome.captchaEnabled}
            disabled={pending}
            {...discreteAutosaveProps}
          />
          <span>
            <strong>Enable captcha by default</strong>
            <span className="settings-flag-desc">
              Form particles that opt in will challenge visitors (Turnstile when selected).
            </span>
          </span>
        </label>
        <label className="settings-field">
          <span>Provider</span>
          <select
            name="captchaProvider"
            defaultValue={chrome.captchaProvider}
            disabled={pending}
            {...discreteAutosaveProps}
          >
            {CAPTCHA_PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
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
          defaults to <code>/</code>.
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

      {state.error ? (
        <p className="admin-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
      {pending ? <p className="field-hint">Saving…</p> : null}
    </form>
  )
}
