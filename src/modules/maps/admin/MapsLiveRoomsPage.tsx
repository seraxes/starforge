import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { listEventCatalog } from '../api.server'
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
      ? listEventCatalog().listEventsForAdmin()
      : Promise.resolve([]),
  ])

  const eventTitleById = new Map(
    events.map((event) => [event.id, eventTitleFromAdminLabel(event.label)]),
  )
  const roomsWithoutMap = events.filter((event) => !rooms.some((room) => room.eventId === event.id))

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
        eventOptions={roomsWithoutMap.map((event) => ({
          id: event.id,
          label: event.label,
        }))}
      />
    </section>
  )
}

/** Catalog labels are `Title (status)`. The room table shows the title. */
function eventTitleFromAdminLabel(label: string): string {
  return label.replace(/ \((draft|published|cancelled)\)$/, '')
}
