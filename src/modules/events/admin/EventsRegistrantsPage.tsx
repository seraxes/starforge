import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { listRegistrationsForEvent } from '../registrations'
import { listEvents } from '../store'
import { listTicketTiersForEvent } from '../tiers'
import { EventsAdminNav } from './events-admin-nav'
import { RegistrantsManager } from './registrants-manager'

export const metadata = {
  title: 'Registrants — Events — Starforge',
  description: 'Event registration list and status (Events module).',
}

type Search = Promise<{ eventId?: string }>

/** product:events densify — registrants admin. */
export default async function EventsRegistrantsPage({
  searchParams,
}: {
  searchParams: Search
}) {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.events)) {
    redirect('/admin/settings')
  }

  const params = await searchParams
  const events = await listEvents()
  const eventId =
    (params.eventId ?? '').trim() ||
    (events[0]?.id ?? '')

  const [registrations, tiers] = await Promise.all([
    eventId
      ? listRegistrationsForEvent(eventId, { includeCancelled: true })
      : Promise.resolve([]),
    eventId ? listTicketTiersForEvent(eventId) : Promise.resolve([]),
  ])

  const tierTitle = new Map(tiers.map((t) => [t.id, t.title]))

  return (
    <section className="admin-section admin-layouts-full">
      <EventsAdminNav active="registrants" />
      <h2>Registrants</h2>
      <p className="lede admin-lede">
        Pick an event, then promote waitlist or cancel. Ticket types:{' '}
        <Link
          href={
            eventId
              ? `/admin/events/tiers?eventId=${encodeURIComponent(eventId)}`
              : '/admin/events/tiers'
          }
        >
          Events → Ticket types
        </Link>
        .
      </p>

      <RegistrantsManager
        events={events.map((e) => ({ id: e.id, title: e.title }))}
        eventId={eventId}
        registrants={registrations.map((r) => ({
          id: r.id,
          name: r.name,
          email: r.email,
          guests: r.guests,
          attendance: r.attendance,
          status: r.status,
          ticketTierId: r.ticketTierId,
          ticketTierTitle: r.ticketTierId
            ? tierTitle.get(r.ticketTierId) || r.ticketTierId
            : '',
          notes: r.notes,
          createdAt: r.createdAt.toISOString(),
        }))}
      />
    </section>
  )
}
