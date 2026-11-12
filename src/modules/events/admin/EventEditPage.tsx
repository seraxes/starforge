import React from 'react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { ensureDefaultUserGroupsSeeded, listUserGroupOptions } from '@/core/acl'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { isRichEditorEnabled } from '@/modules/rich-editor/api.server'

import { listEventCategories } from '../categories'
import { listEventParties } from '../parties'
import { listEventRegistrationFormOptions } from '../registration-form'
import { loadEventsModuleSettings } from '../settings'
import { findEventById, listEvents, listVenues } from '../store'
import {
  countRegisteredGuestsForTier,
  listTicketTiersForEvent,
} from '../tiers'
import { listEventsUserOptions } from '../user-options'
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
  const [event, venues, groups, users, moduleSettings, parties, allEvents, categories, forms] =
    await Promise.all([
      findEventById(id),
      listVenues(),
      listUserGroupOptions(),
      listEventsUserOptions(),
      loadEventsModuleSettings(),
      listEventParties(),
      listEvents(),
      listEventCategories(),
      listEventRegistrationFormOptions(),
    ])
  if (!event) notFound()

  const tiers = await listTicketTiersForEvent(event.id)
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
      memberPrice: t.memberPrice,
      groupPrices: t.groupPrices,
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
      <EventsAdminNav active="events" />
      <p className="sf-events-editor-back">
        <Link href="/admin/events">← Events</Link>
      </p>
      <h2>{event.title}</h2>
      <p className="lede admin-lede">
        Stacked event editor — people, parties, related events, signup note, tiers. Duplicate
        creates a new draft. Manager users need ACL → Events to open admin.
      </p>

      <EventEditor
        defaultTimezone={moduleSettings.settings.defaultTimezone}
        richEditorEnabled={isRichEditorEnabled(settings)}
        groups={groups}
        users={users}
        parties={parties.map((p) => ({
          id: p.id,
          label: `${p.name} (${p.kind})`,
        }))}
        relatedEventOptions={allEvents
          .filter((e) => e.id !== event.id)
          .map((e) => ({ id: e.id, label: e.title }))}
        venues={venues.map((v) => ({ id: v.id, name: v.name }))}
        categories={categories.map((c) => ({ id: c.id, label: c.title }))}
        forms={forms}
        tiers={tiersWithOcc}
        event={{
          id: event.id,
          title: event.title,
          slug: event.slug,
          status: event.status,
          startsAt: event.startsAt ? event.startsAt.toISOString() : null,
          endsAt: event.endsAt ? event.endsAt.toISOString() : null,
          timezone: event.timezone,
          currency: event.currency,
          price: event.price,
          priceRules: event.priceRules,
          venueId: event.venueId,
          description: event.description,
          coverMediaId: event.coverMediaId,
          coverMediaIds: event.coverMediaIds,
          coverDisplayMode: event.coverDisplayMode,
          galleryMediaIds: event.galleryMediaIds,
          capacity: event.capacity,
          waitlistEnabled: event.waitlistEnabled,
          requireApproval: event.requireApproval,
          registrationOpensAt: event.registrationOpensAt
            ? event.registrationOpensAt.toISOString()
            : null,
          registrationClosesAt: event.registrationClosesAt
            ? event.registrationClosesAt.toISOString()
            : null,
          cancellationClosesAt: event.cancellationClosesAt
            ? event.cancellationClosesAt.toISOString()
            : null,
          selfCancelRefund: event.selfCancelRefund,
          merchantUserId: event.merchantUserId,
          managerUserIds: event.managerUserIds,
          helperUserIds: event.helperUserIds,
          managerGroupIds: event.managerGroupIds,
          helperGroupIds: event.helperGroupIds,
          organizerPartyIds: event.organizerPartyIds,
          speakerPartyIds: event.speakerPartyIds,
          sponsorPartyIds: event.sponsorPartyIds,
          relatedEventIds: event.relatedEventIds,
          signupNote: event.signupNote,
          termsUrl: event.termsUrl,
          listed: event.listed,
          featured: event.featured,
          categoryId: event.categoryId,
          registrationFormId: event.registrationFormId,
          hasAccessPassword: event.hasAccessPassword,
          accessTags: event.accessTags,
          updatedAt: event.updatedAt.toISOString(),
        }}
      />
    </section>
  )
}
