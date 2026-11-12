import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getAccessViewer } from '@/core/acl/access'
import { ensureDefaultUserGroupsSeeded, listUserGroupOptions } from '@/core/acl'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { isRichEditorEnabled } from '@/modules/rich-editor/api.server'

import { listEventCategories } from '../categories'
import { listEventParties } from '../parties'
import {
  ensureEventRegistrationFormSeeded,
  listEventRegistrationFormOptions,
} from '../registration-form'
import { countRegistrationStatsForEvents } from '../registrations'
import { loadEventsModuleSettings } from '../settings'
import { listEvents, listVenues, viewerIsAssignedToEvent } from '../store'
import { isEventStatus } from '../types'
import { listEventsUserOptions } from '../user-options'
import { EventsAdminNav } from './events-admin-nav'
import { EventsManager } from './events-manager'

export const metadata = {
  title: 'Events — Starforge',
  description: 'Events list and edit (Events module).',
}

type Search = Promise<{ status?: string; scope?: string; organizer?: string }>

/** product:events events admin. */
export default async function EventsListPage({ searchParams }: { searchParams: Search }) {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.events)) {
    redirect('/admin/settings')
  }

  const params = await searchParams
  const rawStatus = (params.status ?? 'all').trim() || 'all'
  const status =
    rawStatus === 'all' || isEventStatus(rawStatus) ? rawStatus : 'all'
  const scope = (params.scope ?? '').trim() === 'mine' ? 'mine' : 'all'
  const organizerId = (params.organizer ?? '').trim()

  await ensureDefaultUserGroupsSeeded()
  await ensureEventRegistrationFormSeeded()
  const viewer = await getAccessViewer()
  const [eventsRaw, venues, groups, moduleSettings, parties, users, categories, forms] =
    await Promise.all([
      listEvents({ status: status === 'all' ? undefined : status }),
      listVenues(),
      listUserGroupOptions(),
      loadEventsModuleSettings(),
      listEventParties(),
      listEventsUserOptions(),
      listEventCategories(),
      listEventRegistrationFormOptions(),
    ])

  let events = eventsRaw
  if (scope === 'mine') {
    events = events.filter((e) => viewerIsAssignedToEvent(e, viewer))
  }
  if (organizerId) {
    events = events.filter((e) => e.organizerPartyIds.includes(organizerId))
  }

  const venueNameById = new Map(venues.map((v) => [v.id, v.name] as const))
  const categoryTitleById = new Map(categories.map((c) => [c.id, c.title] as const))
  const regStats = await countRegistrationStatsForEvents(events.map((e) => e.id))

  return (
    <section className="admin-section admin-layouts-full">
      <EventsAdminNav active="events" />
      <h2>Events</h2>
      <p className="lede admin-lede">
        <strong>Add +</strong> for a new event · filters · EB-style list. Open a row to edit
        tiers and registrants. Module on/off:{' '}
        <Link href="/admin/settings">Settings → Modules</Link>.
      </p>

      <EventsManager
        statusFilter={status}
        scopeFilter={scope}
        organizerFilter={organizerId}
        organizerOptions={parties.map((p) => ({ id: p.id, label: p.name }))}
        defaultTimezone={moduleSettings.settings.defaultTimezone}
        richEditorEnabled={isRichEditorEnabled(settings)}
        groups={groups}
        users={users}
        parties={parties.map((p) => ({ id: p.id, label: p.name }))}
        venues={venues.map((v) => ({ id: v.id, name: v.name }))}
        categories={categories.map((c) => ({ id: c.id, label: c.title }))}
        forms={forms}
        events={events.map((e) => {
          const stats = regStats.get(e.id) ?? { registered: 0, pending: 0, waitlisted: 0 }
          return {
            id: e.id,
            title: e.title,
            slug: e.slug,
            status: e.status,
            startsAt: e.startsAt ? e.startsAt.toISOString() : null,
            endsAt: e.endsAt ? e.endsAt.toISOString() : null,
            timezone: e.timezone,
            venueId: e.venueId,
            venueName: e.venueId ? venueNameById.get(e.venueId) ?? '' : '',
            categoryTitle: e.categoryId ? categoryTitleById.get(e.categoryId) ?? '' : '',
            description: e.description,
            coverMediaId: e.coverMediaId,
            capacity: e.capacity,
            registrationOpensAt: e.registrationOpensAt
              ? e.registrationOpensAt.toISOString()
              : null,
            registrationClosesAt: e.registrationClosesAt
              ? e.registrationClosesAt.toISOString()
              : null,
            listed: e.listed !== false,
            accessTags: e.accessTags,
            registeredGuests: stats.registered,
            pendingGuests: stats.pending,
            waitlistedGuests: stats.waitlisted,
            updatedAt: e.updatedAt.toISOString(),
          }
        })}
      />
    </section>
  )
}
