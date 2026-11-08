import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { listEvents } from '@/modules/events/store'

import { listMapRooms } from '../store'
import { MapsAdminNav } from './maps-admin-nav'
import { MapsRoomsManager } from './maps-rooms-manager'

export const metadata = {
  title: 'TacMap — Starforge',
  description: 'Tactical Maps — closed event rooms.',
}

/** product:maps TacMap rooms list. */
export default async function MapsLiveRoomsPage() {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.maps)) {
    redirect('/admin/settings')
  }

  const [rooms, events] = await Promise.all([
    listMapRooms(),
    isCatalogModuleEnabled(settings, MODULE_IDS.events)
      ? listEvents()
      : Promise.resolve([]),
  ])

  const eventTitleById = new Map(events.map((e) => [e.id, e.title]))
  const roomsWithoutMap = events.filter((e) => !rooms.some((r) => r.eventId === e.id))

  return (
    <section className="admin-section admin-layouts-full sf-maps-admin">
      <MapsAdminNav active="rooms" />
      <h2>TacMap</h2>
      <p className="lede admin-lede">
        <strong>Tactical Maps</strong> — <strong>Add +</strong> · table · Edit room — teams,
        roster, overlays. Closed same-team tool. Module:{' '}
        <Link href="/admin/settings">Settings → Modules</Link>. Events:{' '}
        <Link href="/admin/events">Events</Link>.
      </p>

      <MapsRoomsManager
        rooms={rooms.map((r) => ({
          id: r.id,
          eventId: r.eventId,
          title: r.title,
          active: r.active,
          eventTitle: eventTitleById.get(r.eventId) || r.eventId,
        }))}
        eventOptions={roomsWithoutMap.map((e) => ({
          id: e.id,
          label: `${e.title} (${e.status})`,
        }))}
      />
    </section>
  )
}
