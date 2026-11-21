import React from 'react'
import Link from 'next/link'

import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { socialPackAdminPage } from '../pack-settings'
import { loadSocialModuleSettings } from '../settings'
import { SocialAdminNav } from './social-admin-nav'
import { SocialSettingsForm } from './social-settings-form'

export const metadata = {
  title: 'Social settings — Starforge',
  description:
    'Social pack settings (composer, feed, audience, stories, challenges, activity).',
}

/** product:social pack settings. Social off → disabled notice, no editor. */
export default async function SocialSettingsPage() {
  const site = await getSiteSettings()
  const on = isCatalogModuleEnabled(site, MODULE_IDS.social)
  const page = socialPackAdminPage(on)

  if (page.mode === 'disabled-notice') {
    return (
      <section className="admin-section admin-layouts-full">
        <SocialAdminNav active="settings" />
        <h2>Social settings</h2>
        <p className="lede admin-lede">
          Pack defaults. Module on/off:{' '}
          <Link href="/admin/settings">Settings → Modules</Link>.
        </p>
        <div className="admin-settings-mosaic">
          <div className="page-settings-panel">
            <div className="page-settings-panel-head">
              <h3>Status</h3>
            </div>
            <div className="page-settings-panel-body">
              <p className="layout-muted settings-hint">{page.notice}</p>
              <p>
                <Link href="/admin/settings">Settings → Modules</Link>
              </p>
            </div>
          </div>
        </div>
      </section>
    )
  }

  const loaded = await loadSocialModuleSettings()

  return (
    <section className="admin-section admin-layouts-full">
      <SocialAdminNav active="settings" />
      <h2>Social settings</h2>
      <p className="lede admin-lede">
        Composer and feed switches, defaults for posts, stories, challenges, and activity
        cards. People, reactions, and reports live under People. Module on/off:{' '}
        <Link href="/admin/settings">Settings → Modules</Link>.
      </p>
      {loaded.isFallback ? (
        <p className="layout-muted">
          Using code defaults (source: {loaded.source}). Run <code>npm run db:migrate</code> if{' '}
          <code>sf_module_settings</code> is missing.
        </p>
      ) : null}
      <SocialSettingsForm settings={loaded.settings} />
    </section>
  )
}
