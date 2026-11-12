import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { listRegistrationsForEvent } from '../registrations'
import { listEvents } from '../store'
import { listTicketTiersForEvent } from '../tiers'
import { CheckInManager } from './check-in-manager'
import { EventsAdminNav } from './events-admin-nav'

export const metadata = {
  title: 'Check-in — Events — Starforge',
  description:
    'Premium door check-in by name or QR (Events module). GPS / beacon later.',
}

type Search = Promise<{ eventId?: string; registrationId?: string }>

/** product:events — manual door check-in (Premium organizer feature). */
export default async function EventsCheckInPage({
  searchParams,
}: {
  searchParams: Search
}) {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.events)) {
    redirect('/admin/settings')
  }

  const params = await searchParams
  const registrationId = (params.registrationId ?? '').trim()
  const events = await listEvents()
  let eventId = (params.eventId ?? '').trim()

  if (!eventId && registrationId) {
    const { findRegistrationById } = await import('../registrations')
    const row = await findRegistrationById(registrationId)
    if (row) eventId = row.eventId
  }
  if (!eventId) eventId = events[0]?.id ?? ''

  const [registrations, tiers] = await Promise.all([
    eventId
      ? listRegistrationsForEvent(eventId, { includeCancelled: true })
      : Promise.resolve([]),
    eventId ? listTicketTiersForEvent(eventId) : Promise.resolve([]),
  ])

  const tierTitle = new Map(tiers.map((t) => [t.id, t.title]))

  return (
    <section className="admin-section admin-layouts-full">
      <EventsAdminNav active="check-in" />
      <h2>
        Check-in{' '}
        <span className="outlines-badge" title="Premium organizer feature — subscription unlock later">
          Premium
        </span>
      </h2>
      <p className="lede admin-lede">
        Premium organizer door check-in: search by name, or scan the attendee QR to
        open this page focused on their ticket. GPS / beacon later. Full list:{' '}
        <Link
          href={
            eventId
              ? `/admin/events/registrants?eventId=${encodeURIComponent(eventId)}`
              : '/admin/events/registrants'
          }
        >
          Events → Registrants
        </Link>
        .
      </p>

      <CheckInManager
        events={events.map((e) => ({
          id: e.id,
          title: e.title,
          startsAt: e.startsAt ? e.startsAt.toISOString() : null,
        }))}
        eventId={eventId}
        registrationId={registrationId}
        registrants={registrations.map((r) => ({
          id: r.id,
          name: r.name,
          email: r.email,
          guests: r.guests,
          status: r.status,
          ticketTierTitle: r.ticketTierId
            ? tierTitle.get(r.ticketTierId) || r.ticketTierId
            : '',
          checkedInAt: r.checkedInAt ? r.checkedInAt.toISOString() : null,
        }))}
      />
    </section>
  )
}
