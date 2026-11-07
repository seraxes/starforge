import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { ensureDefaultUserGroupsSeeded, listUserGroupOptions } from '@/core/acl'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { isRichEditorEnabled } from '@/modules/rich-editor/api.server'

import { loadEventsModuleSettings } from '../settings'
import { listEvents, listVenues } from '../store'
import { isEventStatus } from '../types'
import { EventsAdminNav } from './events-admin-nav'
import { EventsManager } from './events-manager'

export const metadata = {
  title: 'Events — Starforge',
  description: 'Events list and edit (Events module).',
}

type Search = Promise<{ status?: string }>

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

  await ensureDefaultUserGroupsSeeded()
  const [events, venues, groups, moduleSettings] = await Promise.all([
    listEvents({ status: status === 'all' ? undefined : status }),
    listVenues(),
    listUserGroupOptions(),
    loadEventsModuleSettings(),
  ])

  return (
    <section className="admin-section admin-layouts-full">
      <EventsAdminNav active="events" />
      <h2>Events</h2>
      <p className="lede admin-lede">
        Create an event, then edit it on its own page (schedule, registration window, tiers).
        Module on/off: <Link href="/admin/settings">Settings → Modules</Link>. Venues:{' '}
        <Link href="/admin/events/venues">Events → Venues</Link>.
      </p>

      <EventsManager
        statusFilter={status}
        defaultTimezone={moduleSettings.settings.defaultTimezone}
        richEditorEnabled={isRichEditorEnabled(settings)}
        groups={groups}
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
