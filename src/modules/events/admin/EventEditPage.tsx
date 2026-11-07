import React from 'react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { ensureDefaultUserGroupsSeeded, listUserGroupOptions } from '@/core/acl'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { isRichEditorEnabled } from '@/modules/rich-editor/api.server'

import { loadEventsModuleSettings } from '../settings'
import { findEventById, listVenues } from '../store'
import {
  countRegisteredGuestsForTier,
  listTicketTiersForEvent,
} from '../tiers'
import { EventEditor } from './event-editor'
import { EventsAdminNav } from './events-admin-nav'

export const metadata = {
  title: 'Edit event — Starforge',
  description: 'Event editor (Events module).',
}

type Params = Promise<{ eventId: string }>

/** product:events — dedicated event editor. */
export default async function EventEditPage({ params }: { params: Params }) {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.events)) {
    redirect('/admin/settings')
  }

  const { eventId } = await params
  const id = (eventId || '').trim()
  if (!id) notFound()

  await ensureDefaultUserGroupsSeeded()
  const [event, venues, groups, moduleSettings] = await Promise.all([
    findEventById(id),
    listVenues(),
    listUserGroupOptions(),
    loadEventsModuleSettings(),
  ])
  if (!event) notFound()

  const tiers = await listTicketTiersForEvent(event.id)
  const tiersWithOcc = await Promise.all(
    tiers.map(async (t) => ({
      id: t.id,
      eventId: t.eventId,
      title: t.title,
      description: t.description,
      kind: t.kind,
      capacity: t.capacity,
      priceLabel: t.priceLabel,
      sortOrder: t.sortOrder,
      occupied: await countRegisteredGuestsForTier(t.eventId, t.id),
      updatedAt: t.updatedAt.toISOString(),
    })),
  )

  return (
    <section className="admin-section admin-layouts-full">
      <EventsAdminNav active="events" />
      <p className="sf-events-editor-back">
        <Link href="/admin/events">← Events</Link>
      </p>
      <h2>{event.title}</h2>
      <p className="lede admin-lede">
        Stacked event editor — schedule, registration window, venue, capacity, tiers. Public
        signup respects the registration open/close window.
      </p>

      <EventEditor
        defaultTimezone={moduleSettings.settings.defaultTimezone}
        richEditorEnabled={isRichEditorEnabled(settings)}
        groups={groups}
        venues={venues.map((v) => ({ id: v.id, name: v.name }))}
        tiers={tiersWithOcc}
        event={{
          id: event.id,
          title: event.title,
          slug: event.slug,
          status: event.status,
          startsAt: event.startsAt ? event.startsAt.toISOString() : null,
          endsAt: event.endsAt ? event.endsAt.toISOString() : null,
          timezone: event.timezone,
          venueId: event.venueId,
          description: event.description,
          coverMediaId: event.coverMediaId,
          capacity: event.capacity,
          registrationOpensAt: event.registrationOpensAt
            ? event.registrationOpensAt.toISOString()
            : null,
          registrationClosesAt: event.registrationClosesAt
            ? event.registrationClosesAt.toISOString()
            : null,
          accessTags: event.accessTags,
          updatedAt: event.updatedAt.toISOString(),
        }}
      />
    </section>
  )
}
