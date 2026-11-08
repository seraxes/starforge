import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { ensureProfileFormSeeded } from '../profile-form'
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

  await ensureProfileFormSeeded()
  const loaded = await loadProfilesModuleSettings()

  return (
    <section className="admin-section admin-layouts-full">
      <ProfilesAdminNav active="settings" />
      <h2>Profiles settings</h2>
      <p className="lede admin-lede">
        Profile inputs are managed in{' '}
        <Link href="/admin/forms/profile">Forms → Profile</Link>. Privacy defaults and account
        options live here. Module on/off:{' '}
        <Link href="/admin/settings">Settings → Modules</Link>. Members:{' '}
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
