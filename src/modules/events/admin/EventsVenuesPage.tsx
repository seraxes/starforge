import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { ensureDefaultUserGroupsSeeded, listUserGroupOptions } from '@/core/acl'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { listVenues } from '../store'
import { EventsAdminNav } from './events-admin-nav'
import { VenuesManager } from './venues-manager'

export const metadata = {
  title: 'Venues — Starforge',
  description: 'Venue list and edit (Events module).',
}

/** product:events venues admin. */
export default async function EventsVenuesPage() {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.events)) {
    redirect('/admin/settings')
  }

  await ensureDefaultUserGroupsSeeded()
  const [venues, groups] = await Promise.all([listVenues(), listUserGroupOptions()])

  return (
    <section className="admin-section admin-layouts-full">
      <EventsAdminNav active="venues" />
      <h2>Venues</h2>
      <p className="lede admin-lede">
        Place entities for events — name, address, Media cover, and ACL tags. Maps pins bind
        later. Module on/off: <Link href="/admin/settings">Settings → Modules</Link>. Events:{' '}
        <Link href="/admin/events">Events → Events</Link>.
      </p>

      <VenuesManager
        groups={groups}
        venues={venues.map((v) => ({
          id: v.id,
          name: v.name,
          address: v.address,
          coverMediaId: v.coverMediaId,
          accessTags: v.accessTags,
          updatedAt: v.updatedAt.toISOString(),
        }))}
      />
    </section>
  )
}
