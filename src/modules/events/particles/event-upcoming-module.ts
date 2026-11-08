import React from 'react'
import { getLocale } from 'next-intl/server'

import { getAccessViewer } from '@/core/acl/access'
import { isAppLocale } from '@/core/i18n/locales'
import type { StarforgeModule } from '@/core/modules/types'
import { MODULE_IDS, isCatalogModuleEnabled } from '@/core/settings'

import { EventCardGrid } from '../public/EventCardGrid'
import { loadPublicEventCards } from '../public/load-event-cards'
import { readEventUpcomingConfig } from './event-upcoming-config'

/** event-upcoming particle — card mosaic of upcoming events. */
export const eventUpcomingModule: StarforgeModule = {
  id: 'event-upcoming',
  name: 'Event upcoming',
  description: 'Card grid of upcoming published events.',
  defaultWidth: 100,
  navViews: [{ key: 'events', label: 'Events', href: '/events' }],
  render: async ({ slot, settings }) => {
    if (!isCatalogModuleEnabled(settings, MODULE_IDS.events)) {
      return null
    }

    const cfg = readEventUpcomingConfig(slot.config)
    const viewer = await getAccessViewer()
    const localeRaw = await getLocale()
    const locale = isAppLocale(localeRaw) ? localeRaw : undefined

    const { cards } = await loadPublicEventCards({
      locale,
      viewer,
      limit: cfg.limit,
      includePast: cfg.includePast,
    })

    return React.createElement(EventCardGrid, {
      events: cards,
      heading: cfg.heading,
      emptyMessage: cfg.emptyMessage,
    })
  },
}
