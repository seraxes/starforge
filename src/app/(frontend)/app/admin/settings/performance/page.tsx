import React from 'react'
import Link from 'next/link'

import {
  FORM_RATE_LIMIT_MAX_MAX,
  FORM_RATE_LIMIT_MAX_MIN,
  FORM_RATE_LIMIT_WINDOW_SEC_MAX,
  FORM_RATE_LIMIT_WINDOW_SEC_MIN,
  getSiteSettings,
} from '@/core/settings'
import { PerformanceSettingsForm } from './performance-settings-form'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Settings — Performance — Starforge',
  description: 'Form rate limits and related non-secret performance controls.',
}

export default async function AdminSettingsPerformancePage() {
  const settings = await getSiteSettings()

  return (
    <section className="admin-section">
      <h2>Settings — Performance</h2>
      <p className="lede admin-lede">
        Non-secret performance knobs (Form rate-limit max {FORM_RATE_LIMIT_MAX_MIN}–
        {FORM_RATE_LIMIT_MAX_MAX}, window {FORM_RATE_LIMIT_WINDOW_SEC_MIN}–
        {FORM_RATE_LIMIT_WINDOW_SEC_MAX}s). Redis URL, trusted proxy hops, and cache backend stay in{' '}
        <Link href="/app/admin/site-chrome/environment">Environment</Link>. Other topics:{' '}
        <Link href="/app/admin/settings">Modules</Link>,{' '}
        <Link href="/app/admin/settings/admin-ux">Admin UX</Link>,{' '}
        <Link href="/app/admin/settings/auth">Auth</Link>,{' '}
        <Link href="/app/admin/settings/security">Security</Link>.
      </p>
      <PerformanceSettingsForm
        formRateLimitMax={settings.formRateLimitMax}
        formRateLimitWindowSec={settings.formRateLimitWindowSec}
      />
    </section>
  )
}
