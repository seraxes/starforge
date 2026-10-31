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
        Site name and primary nav power the public header (active link on the current path).
        Prefer linking to CMS pages in Payload Globals →{' '}
        <Link href="/admin/globals/site-settings">Site settings</Link>; this form edits
        resolved paths. Feature toggles gate product capabilities (e.g. registration).
      </p>
      <SettingsForm
        siteName={settings.siteName}
        primaryNav={settings.primaryNav}
        features={settings.features}
      />
    </section>
  )
}
