import React from 'react'
import Link from 'next/link'

import { listNavMenus } from '@/core/nav'
import { getSiteSettings, listInstalledModuleCatalog } from '@/core/settings'
import { SettingsForm } from './settings-form'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Site settings — Starforge',
  description: 'Site name, primary nav menu binding, feature toggles, and module on/off list.',
}

export default async function AdminSettingsPage() {
  const [settings, moduleCatalog, navMenus] = await Promise.all([
    getSiteSettings(),
    Promise.resolve(listInstalledModuleCatalog()),
    listNavMenus(),
  ])

  return (
    <section className="admin-section">
      <h2>Site settings & feature toggles</h2>
      <p className="lede admin-lede">
        Site name and which <Link href="/app/admin/nav">Nav</Link> menu set is the public primary
        header. Menu items (pages, URLs, CSS class, title overrides) live under{' '}
        <strong>Nav</strong>. <strong>Modules</strong> lists every modular product piece with on/off
        gates. Also editable in Payload Globals →{' '}
        <Link href="/admin/globals/site-settings">Site settings</Link>.
      </p>
      <SettingsForm
        siteName={settings.siteName}
        primaryNavMenuId={settings.primaryNavMenuId}
        navMenus={navMenus.map((m) => ({
          id: m.id,
          label: m.label,
          itemCount: m.itemCount,
        }))}
        features={settings.features}
        moduleCatalog={moduleCatalog}
        moduleToggles={settings.moduleToggles}
      />
    </section>
  )
}
