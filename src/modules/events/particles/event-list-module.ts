import React from 'react'
import { getLocale } from 'next-intl/server'

import { getAccessViewer } from '@/core/acl/access'
import { isAppLocale } from '@/core/i18n/locales'
import { withLocalePrefix } from '@/core/i18n/path'
import type { StarforgeModule } from '@/core/modules/types'
import { MODULE_IDS, isCatalogModuleEnabled } from '@/core/settings'

import { EventList } from '../public/EventList'
import {
  filterEventsForViewer,
  findVenueById,
  listPublishedEvents,
} from '../store'
import { readEventListConfig } from './event-list-config'

/**
 * event-list particle — upcoming (or all) published events.
 * Gated by product:events.
 */
export const eventListModule: StarforgeModule = {
  id: 'event-list',
  name: 'Event list',
  description: 'Upcoming published events from product:events.',
  defaultWidth: 100,
  navViews: [{ key: 'events', label: 'Events', href: '/events' }],
  render: async ({ slot, settings }) => {
    if (!isCatalogModuleEnabled(settings, MODULE_IDS.events)) {
      return null
    }

    const cfg = readEventListConfig(slot.config)
    const viewer = await getAccessViewer()
    const raw = await listPublishedEvents({
      includePast: cfg.includePast,
      limit: cfg.limit,
    })
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

    const localeRaw = await getLocale()
    const locale = isAppLocale(localeRaw) ? localeRaw : undefined

    return React.createElement(EventList, {
      events: withVenues,
      heading: cfg.heading,
      emptyMessage: cfg.emptyMessage,
      listHref: withLocalePrefix('/events', locale),
    })
  },
}
