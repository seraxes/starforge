import React from 'react'
import Link from 'next/link'

import { getSiteSettings, listInstalledModuleCatalog } from '@/core/settings'
import { SettingsForm } from './settings-form'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Site settings — Starforge',
  description: 'Site name, primary nav, feature toggles, and module on/off list.',
}

export default async function AdminSettingsPage() {
  const settings = await getSiteSettings()
  const moduleCatalog = listInstalledModuleCatalog()

  return (
    <section className="admin-section">
      <h2>Site settings & feature toggles</h2>
      <p className="lede admin-lede">
        Site name and primary nav power the public header (active link on the current path).
        Prefer linking to CMS pages in Payload Globals →{' '}
        <Link href="/admin/globals/site-settings">Site settings</Link>; this form edits
        resolved paths. <strong>Modules</strong> lists installed particles/atoms with on/off
        toggles (layout palette + public/atoms). Feature toggles gate other product capabilities.
      </p>
      <SettingsForm
        siteName={settings.siteName}
        primaryNav={settings.primaryNav}
        features={settings.features}
        moduleCatalog={moduleCatalog}
        moduleToggles={settings.moduleToggles}
      />
    </section>
  )
}
