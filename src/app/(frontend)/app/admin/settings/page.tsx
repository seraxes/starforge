import React from 'react'
import Link from 'next/link'

import { listNavMenus } from '@/core/nav'
import { getSiteSettings, listInstalledModuleCatalog } from '@/core/settings'
import { SettingsForm } from './settings-form'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Site settings — Modules — Starforge',
  description: 'Module on/off list and primary nav menu assignment.',
}

export default async function AdminSettingsModulesPage() {
  const [settings, moduleCatalog, navMenus] = await Promise.all([
    getSiteSettings(),
    Promise.resolve(listInstalledModuleCatalog()),
    listNavMenus(),
  ])

  return (
    <section className="admin-section">
      <h2>Site settings — Modules</h2>
      <p className="lede admin-lede">
        Installed module on/off and which Navigation menu is the public primary. Admin autosave
        debounce lives under <Link href="/app/admin/settings/admin-ux">Admin UX</Link>; registration
        under <Link href="/app/admin/settings/auth">Auth & registration</Link>; captcha under{' '}
        <Link href="/app/admin/settings/integrations">Integrations</Link>. Site name, offline,
        robots, cookies, and email live under{' '}
        <Link href="/app/admin/site-chrome">Site Chrome</Link>. Also editable in Payload Globals →{' '}
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
