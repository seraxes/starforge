import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import React from 'react'

import { getAccessViewer } from '@/core/acl/access'
import { requireContentLocale } from '@/core/content/pages'
import { isValidLocaleCode } from '@/core/i18n'
import { withLocalePrefix } from '@/core/i18n/path'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { getSiteChrome } from '@/core/site-chrome'
import { EventList } from '@/modules/events/public/EventList'
import {
  filterEventsForViewer,
  findVenueById,
  listPublishedEvents,
} from '@/modules/events/store'

type Args = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { locale: localeParam } = await params
  const [settings, chrome] = await Promise.all([getSiteSettings(), getSiteChrome()])
  const siteName = chrome.siteName || settings.siteName

  if (!isValidLocaleCode(localeParam)) {
    return { title: `Not found — ${siteName}` }
  }
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.events)) {
    return { title: `Not found — ${siteName}` }
  }

  return {
    title: 'Events',
    description: `Upcoming events on ${siteName}.`,
  }
}

/**
 * Public events list (product:events PR2).
 * Gated by Site Settings → Modules (`product:events`).
 */
export default async function PublicEventsPage({ params }: Args) {
  const { locale: localeParam } = await params
  if (!isValidLocaleCode(localeParam)) {
    notFound()
  }
  const locale = requireContentLocale(localeParam)
  setRequestLocale(locale)

  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.events)) {
    notFound()
  }

  const viewer = await getAccessViewer()
  const raw = await listPublishedEvents({ limit: 50 })
  const events = filterEventsForViewer(raw, viewer)
  const withVenues = await Promise.all(
    events.map(async (event) => {
      const venue = event.venueId ? await findVenueById(event.venueId) : null
      return {
        id: event.id,
        title: event.title,
        slug: event.slug,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        timezone: event.timezone,
        coverMediaId: event.coverMediaId,
        capacity: event.capacity,
        venueName: venue?.name,
      }
    }),
  )

  return (
    <article className="cms-page sf-events-page">
      <header className="cms-page-header">
        <h1>Events</h1>
      </header>
      <EventList
        events={withVenues}
        emptyMessage="No upcoming events."
        listHref={withLocalePrefix('/events', locale)}
      />
    </article>
  )
}
