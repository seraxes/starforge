'use client'

import React, { useActionState } from 'react'
import Link from 'next/link'

import {
  updatePerformanceSettingsAction,
  type SettingsActionState,
} from '@/core/settings/actions'
import {
  DASHBOARD_ONLINE_WINDOW_MIN_MAX,
  DASHBOARD_ONLINE_WINDOW_MIN_MIN,
  DASHBOARD_REFRESH_INTERVAL_SEC_MAX,
  DASHBOARD_REFRESH_INTERVAL_SEC_MIN,
  FORM_RATE_LIMIT_MAX_MAX,
  FORM_RATE_LIMIT_MAX_MIN,
  FORM_RATE_LIMIT_WINDOW_SEC_MAX,
  FORM_RATE_LIMIT_WINDOW_SEC_MIN,
  NULL_MISS_TTL_SEC_MAX,
  NULL_MISS_TTL_SEC_MIN,
  PUBLISHED_CACHE_TTL_SEC_MAX,
  PUBLISHED_CACHE_TTL_SEC_MIN,
} from '@/core/settings/defaults'

import { useNotifySavedOnOk } from '../../admin-toast'
import { useAutosaveForm } from '../../use-autosave-form'

type Props = {
  formRateLimitMax: number
  formRateLimitWindowSec: number
  publishedCacheEnabled: boolean
  publishedCacheTtlSec: number
  nullMissTtlSec: number
  dashboardRefreshIntervalSec: number
  dashboardOnlineWindowMin: number
}

const initialState: SettingsActionState = {}

export function PerformanceSettingsForm({
  formRateLimitMax,
  formRateLimitWindowSec,
  publishedCacheEnabled,
  publishedCacheTtlSec,
  nullMissTtlSec,
  dashboardRefreshIntervalSec,
  dashboardOnlineWindowMin,
}: Props) {
  const [state, formAction, pending] = useActionState(
    updatePerformanceSettingsAction,
    initialState,
  )
  useNotifySavedOnOk(state, { toastErrors: true })
  const { formRef, textAutosaveProps, discreteAutosaveProps } = useAutosaveForm()

  return (
    <form ref={formRef} action={formAction} className="settings-form settings-form-wide">
      <div className="admin-settings-mosaic">
        <fieldset className="settings-fieldset settings-fieldset-wide">
          <legend>Form submission rate limit</legend>
          <p className="settings-hint">
            Per visitor IP + form key. Uses the shared RateLimiter (memory locally; Redis when{' '}
            <code>REDIS_URL</code> is set). Numbers live in Site Settings — secrets and infra URLs
            stay in gated{' '}
            <Link href="/admin/site-chrome/environment">Chrome → Environment</Link>.
          </p>
          <label className="settings-field">
            <span>Max submissions per window</span>
            <input
              type="number"
              name="formRateLimitMax"
              defaultValue={formRateLimitMax}
              min={FORM_RATE_LIMIT_MAX_MIN}
              max={FORM_RATE_LIMIT_MAX_MAX}
              step={1}
              disabled={pending}
              {...textAutosaveProps}
            />
          </label>
          <label className="settings-field">
            <span>Window (seconds)</span>
            <input
              type="number"
              name="formRateLimitWindowSec"
              defaultValue={formRateLimitWindowSec}
              min={FORM_RATE_LIMIT_WINDOW_SEC_MIN}
              max={FORM_RATE_LIMIT_WINDOW_SEC_MAX}
              step={1}
              disabled={pending}
              {...textAutosaveProps}
            />
          </label>
        </fieldset>

        <fieldset className="settings-fieldset settings-fieldset-wide">
          <legend>Published content cache</legend>
          <p className="settings-hint">
            Non-secret cache knobs for published pages and site settings. Backend selection (
            <code>STARFORGE_CONTENT_CACHE</code>), <code>REDIS_URL</code>, and{' '}
            <code>STARFORGE_TRUSTED_PROXY_HOPS</code> stay under{' '}
            <Link href="/admin/site-chrome/environment">Environment</Link>. Media WebP / resize
            live under Media → Settings; autosave debounce stays under{' '}
            <Link href="/admin/settings/admin-ux">Admin UX</Link>.
          </p>
          <label className="settings-flag">
            <input
              type="checkbox"
              name="publishedCacheEnabled"
              defaultChecked={publishedCacheEnabled}
              disabled={pending}
              {...discreteAutosaveProps}
            />
            <span>
              Enable published content cache
              <span className="settings-flag-desc">
                Off bypasses Next/Redis adapters and always loads fresh (useful while debugging).
              </span>
            </span>
          </label>
          <label className="settings-field">
            <span>Published cache TTL (seconds)</span>
            <input
              type="number"
              name="publishedCacheTtlSec"
              defaultValue={publishedCacheTtlSec}
              min={PUBLISHED_CACHE_TTL_SEC_MIN}
              max={PUBLISHED_CACHE_TTL_SEC_MAX}
              step={1}
              disabled={pending}
              {...textAutosaveProps}
            />
            <span className="settings-flag-desc">
              <code>0</code> = keep until tag invalidation (preferred for CMS). Positive values add a
              time-based safety net ({PUBLISHED_CACHE_TTL_SEC_MIN}–{PUBLISHED_CACHE_TTL_SEC_MAX}).
            </span>
          </label>
          <label className="settings-field">
            <span>Null-miss TTL (seconds)</span>
            <input
              type="number"
              name="nullMissTtlSec"
              defaultValue={nullMissTtlSec}
              min={NULL_MISS_TTL_SEC_MIN}
              max={NULL_MISS_TTL_SEC_MAX}
              step={1}
              disabled={pending}
              {...textAutosaveProps}
            />
            <span className="settings-flag-desc">
              Redis only: how long empty published reads stay cached ({NULL_MISS_TTL_SEC_MIN}–
              {NULL_MISS_TTL_SEC_MAX}). Ignored by the Next.js tag cache.
            </span>
          </label>
        </fieldset>

        <fieldset className="settings-fieldset settings-fieldset-wide">
          <legend>Dashboard</legend>
          <p className="settings-hint">
            Soft-refresh interval for the admin Dashboard at <code>/admin</code>. The Dashboard
            client polls with <code>router.refresh</code> on this interval and pauses while the tab
            is hidden. Online-now counts sessions touched within the window (Better Auth{' '}
            <code>sf_sessions.updated_at</code>).
          </p>
          <label className="settings-field">
            <span>Refresh interval (seconds)</span>
            <input
              type="number"
              name="dashboardRefreshIntervalSec"
              defaultValue={dashboardRefreshIntervalSec}
              min={DASHBOARD_REFRESH_INTERVAL_SEC_MIN}
              max={DASHBOARD_REFRESH_INTERVAL_SEC_MAX}
              step={1}
              disabled={pending}
              {...textAutosaveProps}
            />
          </label>
          <label className="settings-field">
            <span>Online window (minutes)</span>
            <input
              type="number"
              name="dashboardOnlineWindowMin"
              defaultValue={dashboardOnlineWindowMin}
              min={DASHBOARD_ONLINE_WINDOW_MIN_MIN}
              max={DASHBOARD_ONLINE_WINDOW_MIN_MAX}
              step={1}
              disabled={pending}
              {...textAutosaveProps}
            />
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
