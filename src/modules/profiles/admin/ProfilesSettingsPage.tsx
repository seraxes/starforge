import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { loadProfilesModuleSettings } from '../settings.server'
import { ProfilesAdminNav } from './profiles-admin-nav'
import { ProfilesSettingsForm } from './profiles-settings-form'

export const metadata = {
  title: 'Profiles settings — Starforge',
  description: 'Profiles module settings (fields, privacy defaults, uploads).',
}

/** product:profiles settings admin. */
export default async function ProfilesSettingsPage() {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.profiles)) {
    redirect('/admin/settings')
  }

  const loaded = await loadProfilesModuleSettings()

  return (
    <section className="admin-section admin-layouts-full">
      <ProfilesAdminNav active="settings" />
      <h2>Profiles settings</h2>
      <p className="lede admin-lede">
        Which profile fields exist, which are required, and who sees what by default. Module
        on/off: <Link href="/admin/settings">Settings → Modules</Link>. Members:{' '}
        <Link href="/admin/profiles">Profiles</Link>.
      </p>
      {loaded.isFallback ? (
        <p className="layout-muted">
          Using code defaults (source: {loaded.source}). Run <code>npm run db:migrate</code> if{' '}
          <code>sf_module_settings</code> is missing.
        </p>
      ) : null}
      <ProfilesSettingsForm settings={loaded.settings} />
    </section>
  )
}
