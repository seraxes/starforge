import React from 'react'
import { getLocale } from 'next-intl/server'

import { getAccessViewer } from '@/core/acl/access'
import { isAppLocale } from '@/core/i18n/locales'
import type { StarforgeModule } from '@/core/modules/types'
import { MODULE_IDS, isCatalogModuleEnabled } from '@/core/settings'

import { EventTableList } from '../public/EventTableList'
import { loadPublicEventCards } from '../public/load-event-cards'
import { readEventListConfig } from './event-list-config'

/**
 * event-list particle — dense table (listázás). Card mosaic = upcoming view / hub.
 */
export const eventListModule: StarforgeModule = {
  id: 'event-list',
  name: 'Event list',
  description: 'Published events as a dense table from product:events.',
  defaultWidth: 100,
  navViews: [{ key: 'events', label: 'Events', href: '/events' }],
  render: async ({ slot, settings }) => {
    if (!isCatalogModuleEnabled(settings, MODULE_IDS.events)) {
      return null
    }

    const cfg = readEventListConfig(slot.config)
    const viewer = await getAccessViewer()
    const localeRaw = await getLocale()
    const locale = isAppLocale(localeRaw) ? localeRaw : undefined

    const { cards } = await loadPublicEventCards({
      locale,
      viewer,
      limit: cfg.limit,
      includePast: cfg.includePast,
    })

    return React.createElement(
      'section',
      { className: 'sf-event-list-particle', 'aria-label': cfg.heading || 'Events' },
      cfg.heading.trim()
        ? React.createElement('h2', { className: 'sf-events-section-heading' }, cfg.heading.trim())
        : null,
      React.createElement(EventTableList, {
        events: cards,
        emptyMessage: cfg.emptyMessage,
      }),
    )
  },
}
