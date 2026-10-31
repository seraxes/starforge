import React from 'react'
import Link from 'next/link'

import { getSiteSettings } from '@/core/settings'
import { SettingsForm } from './settings-form'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Site settings — Starforge',
  description: 'Site name, primary nav, and feature toggles.',
}

export default async function AdminSettingsPage() {
  const settings = await getSiteSettings()

  return (
    <section className="admin-section">
      <h2>Site settings & feature toggles</h2>
      <p className="lede admin-lede">
        Site name and primary nav power the public header. Feature toggles gate product
        capabilities (e.g. registration). Same document lives in Payload Globals →{' '}
        <Link href="/admin/globals/site-settings">Site settings</Link> for CMS editors.
      </p>
      <SettingsForm
        siteName={settings.siteName}
        primaryNav={settings.primaryNav}
        features={settings.features}
      />
    </section>
  )
}
