import React from 'react'
import Link from 'next/link'

import { getMailerInfo } from '@/core/mail'
import { getMapProvider } from '@/core/maps'
import { getRealtimePort } from '@/core/realtime'
import { redisUrlFromEnv } from '@/core/redis/client'
import {
  FORM_RATE_LIMIT_MAX_MAX,
  FORM_RATE_LIMIT_MAX_MIN,
  FORM_RATE_LIMIT_WINDOW_SEC_MAX,
  FORM_RATE_LIMIT_WINDOW_SEC_MIN,
  getSiteSettings,
} from '@/core/settings'
import {
  PerformanceSettingsForm,
  type PerformancePortGlance,
} from './performance-settings-form'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Settings — Performance — Starforge',
  description: 'Core ports, RealtimePort, form rate limits, and published-content cache.',
}

export default async function AdminSettingsPerformancePage() {
  const [settings, mailer, realtime, mapProvider] = await Promise.all([
    getSiteSettings(),
    getMailerInfo(),
    Promise.resolve(getRealtimePort().info()),
    getMapProvider(),
  ])

  const redisConfigured = Boolean(redisUrlFromEnv())
  const ports: PerformancePortGlance[] = [
    {
      id: 'realtime',
      label: 'RealtimePort',
      status: settings.realtimeEnabled ? `on · ${realtime.label}` : 'off',
      detail: 'SSE now; Redis fanout later',
    },
    {
      id: 'mailer',
      label: 'Mailer',
      status: mailer.enabled
        ? `${mailer.provider}${mailer.ready ? '' : ' (not ready)'}`
        : 'disabled',
      detail: mailer.from ? `From ${mailer.from}` : undefined,
      href: '/admin/site-chrome',
      hrefLabel: 'Chrome',
    },
    {
      id: 'cache',
      label: 'PublishedContentCache',
      status: settings.publishedCacheEnabled ? 'on' : 'off',
      detail: 'backend via Environment',
      href: '/admin/site-chrome/environment',
      hrefLabel: 'Environment',
    },
    {
      id: 'rate-limit',
      label: 'RateLimiter',
      status: redisConfigured ? 'Redis' : 'memory',
      detail: 'Forms + shared consume()',
    },
    {
      id: 'maps',
      label: 'MapProvider',
      status: mapProvider.id,
      detail: 'product:maps / Events venues',
    },
  ]

  return (
    <section className="admin-section">
      <h2>Settings — Performance</h2>
      <p className="lede admin-lede">
        Core ports at a glance, RealtimePort on/off, Form rate-limit max {FORM_RATE_LIMIT_MAX_MIN}–
        {FORM_RATE_LIMIT_MAX_MAX}, window {FORM_RATE_LIMIT_WINDOW_SEC_MIN}–
        {FORM_RATE_LIMIT_WINDOW_SEC_MAX}s; published-cache on/off, TTL, null-miss TTL. Redis URL,
        trusted proxy hops, and cache backend stay in{' '}
        <Link href="/admin/site-chrome/environment">Environment</Link>. Other topics:{' '}
        <Link href="/admin/settings">Modules</Link>,{' '}
        <Link href="/admin/settings/admin-ux">Admin UX</Link>,{' '}
        <Link href="/admin/settings/auth">Auth</Link>,{' '}
        <Link href="/admin/settings/security">Security</Link>.
      </p>
      <PerformanceSettingsForm
        formRateLimitMax={settings.formRateLimitMax}
        formRateLimitWindowSec={settings.formRateLimitWindowSec}
        publishedCacheEnabled={settings.publishedCacheEnabled}
        publishedCacheTtlSec={settings.publishedCacheTtlSec}
        nullMissTtlSec={settings.nullMissTtlSec}
        dashboardRefreshIntervalSec={settings.dashboardRefreshIntervalSec}
        dashboardOnlineWindowMin={settings.dashboardOnlineWindowMin}
        realtimeEnabled={settings.realtimeEnabled}
        realtimeAdapterLabel={realtime.label}
        ports={ports}
      />
    </section>
  )
}
