import React from 'react'
import Link from 'next/link'

import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { socialPackAdminPage } from '../pack-settings'
import { listPagesDirectory } from '../pages-store'
import { loadSocialModuleSettings } from '../settings'
import { SocialAdminNav } from './social-admin-nav'
import { SocialPagesSettingsForm } from './social-pages-settings-form'

export const metadata = {
  title: 'Social pages — Starforge',
  description: 'Social pages creation rules, likes, and verified list.',
}

/** product:social pages admin (slice 15d). */
export default async function SocialPagesSettingsPage() {
  const site = await getSiteSettings()
  const on = isCatalogModuleEnabled(site, MODULE_IDS.social)
  const page = socialPackAdminPage(on)

  if (page.mode === 'disabled-notice') {
    return (
      <section className="admin-section admin-layouts-full">
        <SocialAdminNav active="pages" />
        <h2>Pages</h2>
        <p className="lede admin-lede">
          Creation rules, likes, and the verified page list. Module on/off:{' '}
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

  const [loaded, directory] = await Promise.all([
    loadSocialModuleSettings(),
    listPagesDirectory({ limit: 100 }),
  ])

  return (
    <section className="admin-section admin-layouts-full">
      <SocialAdminNav active="pages" />
      <h2>Pages</h2>
      <p className="lede admin-lede">
        Creation rules, likes on/off, and the verified page list with optional site-page id.
        Module on/off: <Link href="/admin/settings">Settings → Modules</Link>.
      </p>
      {loaded.isFallback ? (
        <p className="layout-muted">
          Using code defaults (source: {loaded.source}). Run <code>npm run db:migrate</code> if{' '}
          <code>sf_module_settings</code> is missing.
        </p>
      ) : null}
      <SocialPagesSettingsForm
        settings={loaded.settings}
        pages={directory.map(({ page }) => ({
          id: page.id,
          name: page.name,
          slug: page.slug,
          ownerUserId: page.ownerUserId,
          sitePageId: page.sitePageId ?? '',
          verifiedAt: page.verifiedAt?.toISOString() ?? '',
        }))}
      />
    </section>
  )
}
