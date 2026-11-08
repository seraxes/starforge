import React from 'react'
import { getLocale } from 'next-intl/server'

import { getAccessViewer } from '@/core/acl/access'
import { isAppLocale } from '@/core/i18n/locales'
import type { StarforgeModule } from '@/core/modules/types'
import { MODULE_IDS, isCatalogModuleEnabled } from '@/core/settings'

import { EventCalendarMonth } from '../public/EventCalendarMonth'
import { loadPublicEventCards } from '../public/load-event-cards'
import { readEventCalendarConfig } from './event-calendar-config'

/** event-calendar particle — month grid; placeable in layouts. */
export const eventCalendarModule: StarforgeModule = {
  id: 'event-calendar',
  name: 'Event calendar',
  description: 'Month calendar of published events (title, seats, venue).',
  defaultWidth: 100,
  navViews: [{ key: 'events', label: 'Events', href: '/events' }],
  render: async ({ slot, settings }) => {
    if (!isCatalogModuleEnabled(settings, MODULE_IDS.events)) {
      return null
    }

    const cfg = readEventCalendarConfig(slot.config)
    const viewer = await getAccessViewer()
    const localeRaw = await getLocale()
    const locale = isAppLocale(localeRaw) ? localeRaw : undefined

    const { cards } = await loadPublicEventCards({
      locale,
      viewer,
      limit: cfg.limit,
    })

    return React.createElement(
      'section',
      { className: 'sf-event-calendar-particle', 'aria-label': cfg.heading || 'Calendar' },
      cfg.heading.trim()
        ? React.createElement('h2', { className: 'sf-events-section-heading' }, cfg.heading.trim())
        : null,
      React.createElement(EventCalendarMonth, {
        events: cards,
        showThumbnails: cfg.showThumbnails,
      }),
    )
  },
}
