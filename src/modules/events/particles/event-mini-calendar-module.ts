import React from 'react'
import { getLocale } from 'next-intl/server'

import { getAccessViewer } from '@/core/acl/access'
import { isAppLocale } from '@/core/i18n/locales'
import { withLocalePrefix } from '@/core/i18n/path'
import type { StarforgeModule } from '@/core/modules/types'
import { MODULE_IDS, isCatalogModuleEnabled } from '@/core/settings'

import { EventMiniCalendar } from '../public/EventMiniCalendar'
import { loadPublicEventCards } from '../public/load-event-cards'
import { readEventMiniCalendarConfig } from './event-mini-calendar-config'

/**
 * event-mini-calendar particle — compact month + upcoming list.
 * Place in any layout position (sidebar, etc.).
 */
export const eventMiniCalendarModule: StarforgeModule = {
  id: 'event-mini-calendar',
  name: 'Event mini calendar',
  description: 'Compact month calendar of upcoming published events.',
  defaultWidth: 25,
  navViews: [{ key: 'events', label: 'Events', href: '/events' }],
  render: async ({ slot, settings }) => {
    if (!isCatalogModuleEnabled(settings, MODULE_IDS.events)) {
      return null
    }

    const cfg = readEventMiniCalendarConfig(slot.config)
    const viewer = await getAccessViewer()
    const localeRaw = await getLocale()
    const locale = isAppLocale(localeRaw) ? localeRaw : undefined

    const { cards } = await loadPublicEventCards({
      locale,
      viewer,
      limit: cfg.limit,
      includePast: false,
    })

    return React.createElement(EventMiniCalendar, {
      events: cards,
      heading: cfg.heading,
      calendarHref: cfg.showCalendarLink
        ? `${withLocalePrefix('/events', locale)}?view=calendar`
        : undefined,
    })
  },
}
