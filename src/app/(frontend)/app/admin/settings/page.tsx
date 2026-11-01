import React from 'react'
import Link from 'next/link'

import { listNavMenus } from '@/core/nav'
import { getSiteSettings, listInstalledModuleCatalog } from '@/core/settings'
import { SettingsForm } from './settings-form'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Site settings — Starforge',
  description: 'Primary nav menu assignment and module on/off list.',
}

export default async function AdminSettingsPage() {
  const [settings, moduleCatalog, navMenus] = await Promise.all([
    getSiteSettings(),
    Promise.resolve(listInstalledModuleCatalog()),
    listNavMenus(),
  ])

  return (
    <section className="admin-section">
      <h2>Site settings & Modules</h2>
      <p className="lede admin-lede">
        Module on/off and <em>which</em> menu is the public primary (assignment only). Site name,
        offline, robots, and cookies live under{' '}
        <Link href="/app/admin/site-chrome">Site Chrome</Link>. Navigation sets under the top-level{' '}
        <Link href="/app/admin/nav">Nav</Link> admin item. Also editable in Payload Globals →{' '}
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
