import React from 'react'
import { getLocale } from 'next-intl/server'

import { getAccessViewer } from '@/core/acl/access'
import { isAppLocale } from '@/core/i18n/locales'
import type { StarforgeModule } from '@/core/modules/types'
import { MODULE_IDS, isCatalogModuleEnabled } from '@/core/settings'

import { EventFeaturedCarousel } from '../public/EventFeaturedCarousel'
import { loadPublicEventCards } from '../public/load-event-cards'
import { readEventFeaturedConfig } from './event-featured-config'

/**
 * event-featured particle — rotating carousel of events with featured=true.
 * Place anywhere in Layouts; not baked into /events views.
 */
export const eventFeaturedModule: StarforgeModule = {
  id: 'event-featured',
  name: 'Event featured',
  description: 'Rotating carousel of featured published events.',
  defaultWidth: 100,
  navViews: [{ key: 'events', label: 'Events', href: '/events' }],
  render: async ({ slot, settings }) => {
    if (!isCatalogModuleEnabled(settings, MODULE_IDS.events)) {
      return null
    }

    const cfg = readEventFeaturedConfig(slot.config)
    const viewer = await getAccessViewer()
    const localeRaw = await getLocale()
    const locale = isAppLocale(localeRaw) ? localeRaw : undefined

    const { cards } = await loadPublicEventCards({
      locale,
      viewer,
      limit: cfg.limit,
      includePast: cfg.includePast,
      featuredOnly: true,
    })

    if (cards.length === 0) {
      return React.createElement(
        'p',
        { className: 'sf-event-list-empty settings-hint' },
        'No featured events yet — mark events as Featured in admin.',
      )
    }

    return React.createElement(EventFeaturedCarousel, {
      events: cards,
      heading: cfg.heading,
      intervalMs: cfg.intervalMs,
    })
  },
}
