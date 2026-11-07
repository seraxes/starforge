import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { listEventParties } from '../parties'
import { EventsAdminNav } from './events-admin-nav'
import { PartiesManager } from './parties-manager'

export const metadata = {
  title: 'Parties — Events — Starforge',
  description: 'Organizer / speaker / sponsor parties (Events module).',
}

/** product:events Wave B — party profiles. */
export default async function EventsPartiesPage() {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.events)) {
    redirect('/admin/settings')
  }

  const parties = await listEventParties()

  return (
    <section className="admin-section admin-layouts-full">
      <EventsAdminNav active="parties" />
      <h2>Parties</h2>
      <p className="lede admin-lede">
        Shared organizer / speaker / sponsor profiles. Attach them on each{' '}
        <Link href="/admin/events">event</Link> editor. Not a full CRM.
      </p>
      <PartiesManager
        parties={parties.map((p) => ({
          id: p.id,
          name: p.name,
          kind: p.kind,
          url: p.url,
          blurb: p.blurb,
          avatarMediaId: p.avatarMediaId,
          updatedAt: p.updatedAt.toISOString(),
        }))}
      />
    </section>
  )
}
