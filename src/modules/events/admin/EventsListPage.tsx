import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getAccessViewer } from '@/core/acl/access'
import { ensureDefaultUserGroupsSeeded, listUserGroupOptions } from '@/core/acl'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { isRichEditorEnabled } from '@/modules/rich-editor/api.server'

import { listEventParties } from '../parties'
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
  const viewer = await getAccessViewer()
  const [eventsRaw, venues, groups, moduleSettings, parties, users] = await Promise.all([
    listEvents({ status: status === 'all' ? undefined : status }),
    listVenues(),
    listUserGroupOptions(),
    loadEventsModuleSettings(),
    listEventParties(),
    listEventsUserOptions(),
  ])

  let events = eventsRaw
  if (scope === 'mine') {
    events = events.filter((e) => viewerIsAssignedToEvent(e, viewer))
  }
  if (organizerId) {
    events = events.filter((e) => e.organizerPartyIds.includes(organizerId))
  }

  return (
    <section className="admin-section admin-layouts-full">
      <EventsAdminNav active="events" />
      <h2>Events</h2>
      <p className="lede admin-lede">
        Create with the full form below, or open an event for tiers and registrants. Module
        on/off: <Link href="/admin/settings">Settings → Modules</Link>. Venues:{' '}
        <Link href="/admin/events/venues">Events → Venues</Link>. Parties:{' '}
        <Link href="/admin/events/parties">Events → Parties</Link>.
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
        events={events.map((e) => ({
          id: e.id,
          title: e.title,
          slug: e.slug,
          status: e.status,
          startsAt: e.startsAt ? e.startsAt.toISOString() : null,
          endsAt: e.endsAt ? e.endsAt.toISOString() : null,
          timezone: e.timezone,
          venueId: e.venueId,
          description: e.description,
          coverMediaId: e.coverMediaId,
          capacity: e.capacity,
          registrationOpensAt: e.registrationOpensAt
            ? e.registrationOpensAt.toISOString()
            : null,
          registrationClosesAt: e.registrationClosesAt
            ? e.registrationClosesAt.toISOString()
            : null,
          accessTags: e.accessTags,
          updatedAt: e.updatedAt.toISOString(),
        }))}
      />
    </section>
  )
}
