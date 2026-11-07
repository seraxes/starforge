import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { ensureDefaultUserGroupsSeeded, listUserGroupOptions } from '@/core/acl'
import { getMapProvider } from '@/core/maps'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { isRichEditorEnabled } from '@/modules/rich-editor/api.server'

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
  const mapsEnabled = isCatalogModuleEnabled(settings, MODULE_IDS.maps)
  const [venues, groups, mapClientConfig] = await Promise.all([
    listVenues(),
    listUserGroupOptions(),
    mapsEnabled
      ? getMapProvider().then((p) => p.clientConfig())
      : Promise.resolve(null),
  ])

  return (
    <section className="admin-section admin-layouts-full">
      <EventsAdminNav active="venues" />
      <h2>Venues</h2>
      <p className="lede admin-lede">
        <strong>Add +</strong> · table · Edit one venue — description, gallery, Leaflet pin
        (product:maps). Module:{' '}
        <Link href="/admin/settings">Settings → Modules</Link>. Events:{' '}
        <Link href="/admin/events">Events</Link>.
      </p>

      <VenuesManager
        groups={groups}
        mapsEnabled={mapsEnabled}
        mapClientConfig={mapClientConfig}
        richEditorEnabled={isRichEditorEnabled(settings)}
        venues={venues.map((v) => ({
          id: v.id,
          name: v.name,
          address: v.address,
          description: v.description,
          latitude: v.latitude,
          longitude: v.longitude,
          coverMediaId: v.coverMediaId,
          galleryMediaIds: v.galleryMediaIds,
          accessTags: v.accessTags,
          updatedAt: v.updatedAt.toISOString(),
        }))}
      />
    </section>
  )
}
