import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { loadEventsModuleSettings } from '../settings'
import { EventsAdminNav } from './events-admin-nav'
import { EventsSettingsForm } from './events-settings-form'

export const metadata = {
  title: 'Events settings — Starforge',
  description: 'Events module settings (default timezone and knobs).',
}

/** product:events settings admin (SF-230 Settings leaf). */
export default async function EventsSettingsPage() {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.events)) {
    redirect('/admin/settings')
  }

  const loaded = await loadEventsModuleSettings()

  return (
    <section className="admin-section admin-layouts-full">
      <EventsAdminNav active="settings" />
      <h2>Events settings</h2>
      <p className="lede admin-lede">
        Module knobs stored in <code>sf_module_settings</code> (id <code>product:events</code>).
        Also linked from <Link href="/admin/settings">Settings → Modules</Link> → Info /
        Settings. Events list: <Link href="/admin/events">Events → Events</Link>.
      </p>
      {loaded.isFallback ? (
        <p className="layout-muted">
          Using code defaults (source: {loaded.source}). Run{' '}
          <code>npm run db:migrate</code> if <code>sf_module_settings</code> is missing.
        </p>
      ) : null}
      <EventsSettingsForm settings={loaded.settings} />
    </section>
  )
}
