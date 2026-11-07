import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getGlobalPageChrome } from '@/core/page-settings'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { loadPwaModuleSettings } from '../settings'
import { PwaSettingsForm } from './pwa-settings-form'

export const metadata = {
  title: 'PWA settings — Starforge',
  description: 'Progressive Web App manifest knobs (theme color, display, icons).',
}

/** product:pwa settings admin. */
export default async function PwaSettingsPage() {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.pwa)) {
    redirect('/admin/settings')
  }

  const [loaded, chrome] = await Promise.all([
    loadPwaModuleSettings(),
    getGlobalPageChrome(),
  ])
  const hasChromeIcons = Boolean(
    chrome.faviconUrl?.trim() || chrome.touchIconUrl?.trim(),
  )

  return (
    <section className="admin-section admin-layouts-full">
      <h2>PWA</h2>
      <p className="lede admin-lede">
        Installable Progressive Web App. Manifest at{' '}
        <code>/manifest.webmanifest</code>; service worker registers on the public site
        when this module is on. Module on/off:{' '}
        <Link href="/admin/settings">Settings → Modules</Link>. Branding:{' '}
        <Link href="/admin/site-chrome">Site Chrome</Link> ·{' '}
        <Link href="/admin/page-settings">Page Settings</Link>.
      </p>
      {loaded.isFallback ? (
        <p className="layout-muted">
          Using code defaults (source: {loaded.source}). Run{' '}
          <code>npm run db:migrate</code> if <code>sf_module_settings</code> is missing.
        </p>
      ) : null}
      <div className="admin-settings-mosaic">
        <PwaSettingsForm settings={loaded.settings} hasChromeIcons={hasChromeIcons} />
      </div>
    </section>
  )
}
