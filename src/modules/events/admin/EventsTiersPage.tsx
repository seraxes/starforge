import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { listEvents } from '../store'
import {
  countRegisteredGuestsForTier,
  listTicketTiersForEvent,
} from '../tiers'
import { EventsAdminNav } from './events-admin-nav'
import { TiersManager } from './tiers-manager'

export const metadata = {
  title: 'Ticket tiers — Events — Starforge',
  description: 'Ticket / faction tiers per event (Events module).',
}

type Search = Promise<{ eventId?: string }>

/** product:events densify — ticket tiers admin. */
export default async function EventsTiersPage({
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

  const tiers =
    eventId.length > 0 ? await listTicketTiersForEvent(eventId) : []

  const tiersWithOcc = await Promise.all(
    tiers.map(async (t) => ({
      id: t.id,
      eventId: t.eventId,
      title: t.title,
      shortDescription: t.shortDescription,
      description: t.description,
      kind: t.kind,
      capacity: t.capacity,
      maxPerBooking: t.maxPerBooking,
      price: t.price,
      priceModifier: t.priceModifier,
      priceModifierMode: t.priceModifierMode,
      priceLabel: t.priceLabel,
      titleColor: t.titleColor,
      borderColor: t.borderColor,
      backgroundColor: t.backgroundColor,
      sortOrder: t.sortOrder,
      occupied: await countRegisteredGuestsForTier(t.eventId, t.id),
      updatedAt: t.updatedAt.toISOString(),
    })),
  )

  return (
    <section className="admin-section admin-layouts-full">
      <EventsAdminNav active="tiers" />
      <h2>Ticket types</h2>
      <p className="lede admin-lede">
        Per-event ticket / faction slots (same UI as on the event editor). Pick an event below,
        or open an event and manage types there. Public page shows the list; signup select when
        types exist. Registrants:{' '}
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

      <TiersManager
        events={events.map((e) => ({ id: e.id, title: e.title }))}
        eventId={eventId}
        tiers={tiersWithOcc}
      />
    </section>
  )
}
