import React from 'react'
import Link from 'next/link'

import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import {
  ensureDefaultGroupCategories,
  listGroupCategories,
  listGroupsDirectory,
} from '../groups-store'
import { socialPackAdminPage } from '../pack-settings'
import { loadSocialModuleSettings } from '../settings'
import { SocialAdminNav } from './social-admin-nav'
import { SocialGroupsSettingsForm } from './social-groups-settings-form'

export const metadata = {
  title: 'Social groups — Starforge',
  description: 'Social groups creation rules, categories, and verified list.',
}

/** product:social groups admin (slice 15d). */
export default async function SocialGroupsSettingsPage() {
  const site = await getSiteSettings()
  const on = isCatalogModuleEnabled(site, MODULE_IDS.social)
  const page = socialPackAdminPage(on)

  if (page.mode === 'disabled-notice') {
    return (
      <section className="admin-section admin-layouts-full">
        <SocialAdminNav active="groups" />
        <h2>Groups</h2>
        <p className="lede admin-lede">
          Creation rules, categories, and the verified group list. Module on/off:{' '}
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

  await ensureDefaultGroupCategories()
  const [loaded, categories, directory] = await Promise.all([
    loadSocialModuleSettings(),
    listGroupCategories(),
    listGroupsDirectory({ limit: 100 }),
  ])

  return (
    <section className="admin-section admin-layouts-full">
      <SocialAdminNav active="groups" />
      <h2>Groups</h2>
      <p className="lede admin-lede">
        Creation rules, categories, verified list, and switches for documents, announcements,
        and the join form. Ranks stay on the group page. Module on/off:{' '}
        <Link href="/admin/settings">Settings → Modules</Link>.
      </p>
      {loaded.isFallback ? (
        <p className="layout-muted">
          Using code defaults (source: {loaded.source}). Run <code>npm run db:migrate</code> if{' '}
          <code>sf_module_settings</code> is missing.
        </p>
      ) : null}
      <SocialGroupsSettingsForm
        settings={loaded.settings}
        categories={categories.map((row) => ({
          id: row.id,
          name: row.name,
          slug: row.slug,
          kind: row.kind,
        }))}
        groups={directory.map(({ group, category }) => ({
          id: group.id,
          name: group.name,
          slug: group.slug,
          ownerUserId: group.ownerUserId,
          categoryName: category?.name ?? '',
          verifiedAt: group.verifiedAt?.toISOString() ?? '',
        }))}
      />
    </section>
  )
}
