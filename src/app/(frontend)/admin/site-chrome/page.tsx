import React from 'react'
import Link from 'next/link'

import { hydrateSiteChromeConsentLocales } from '@/core/i18n/content-locales'
import { getContentLocaleOptions } from '@/core/i18n/locale-text.server'
import { listLayoutOutlines } from '@/core/modules/layout-store'
import {
  DEFAULT_OFFLINE_LAYOUT_ID,
  getSiteChrome,
} from '@/core/site-chrome'
import { ensureSkinOutlineSeeds, getActiveSkin } from '@/core/skin'
import { SiteChromeForm } from './site-chrome-form'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Chrome — Starforge',
  description:
    'Site offline, outbound email, metadata, robots, content rights, cookie scope, and Environment.',
}

export default async function AdminSiteChromePage() {
  const [chromeRaw, activeSkin, locales] = await Promise.all([
    getSiteChrome(),
    getActiveSkin(),
    getContentLocaleOptions(),
  ])
  const chrome = await hydrateSiteChromeConsentLocales(chromeRaw)
  // Ensure Pastel (or active skin) offline outline seed exists for the picker.
  await ensureSkinOutlineSeeds(activeSkin.id)
  const outlines = await listLayoutOutlines()
  const outlineOptions =
    outlines.length > 0
      ? outlines.map((o) => ({ id: o.id, label: o.label }))
      : [{ id: DEFAULT_OFFLINE_LAYOUT_ID, label: 'Pastel — Offline' }]
  if (!outlineOptions.some((o) => o.id === chrome.offlineLayoutId)) {
    outlineOptions.unshift({
      id: chrome.offlineLayoutId,
      label: chrome.offlineLayoutId,
    })
  }

  return (
    <section className="admin-section">
      <h2>Chrome</h2>
      <p className="lede admin-lede">
        Site-wide policy and defaults — offline, SEO/metadata, cookies, outbound email, and
        Environment. Languages live under{' '}
        <Link href="/admin/localization">Localization</Link>. Captcha enable/provider moved to{' '}
        <Link href="/admin/settings/security">Settings → Security</Link>. Modules
        on/off under <Link href="/admin/settings">Settings → Modules</Link>; navigation
        sets under <Link href="/admin/nav">Navigation</Link>; document chrome / Font Awesome
        under <Link href="/admin/page-settings">Layouts → Page settings</Link>. Secrets stay in
        env — gated <Link href="/admin/site-chrome/environment">Environment</Link> writes{' '}
        <code>.env.local</code>, not this form or the database.
      </p>
      <SiteChromeForm chrome={chrome} outlines={outlineOptions} locales={locales} />
    </section>
  )
}
