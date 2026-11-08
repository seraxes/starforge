import React from 'react'

import type { AccessViewer } from '@/core/acl/types'
import type { AppLocale } from '@/core/i18n/locales'
import { withLocalePrefix } from '@/core/i18n/path'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { EventCalendarMonth } from './EventCalendarMonth'
import { EventCardGrid } from './EventCardGrid'
import { EventTableList } from './EventTableList'
import { EventsMapPanel } from './EventsMapPanel'
import {
  EventsViewTabs,
  parseEventsHubView,
  type EventsHubView,
} from './EventsViewTabs'
import { loadPublicEventCards } from './load-event-cards'

export type EventsHubProps = {
  locale: AppLocale
  viewer: AccessViewer
  viewRaw?: string | string[]
  /** Calendar thumbnails from `?thumbs=1` (hub toggle). */
  thumbsRaw?: string | string[]
}

/**
 * Public Events hub — clean views only (upcoming / calendar / map / list).
 * Featured carousel + mini calendar are layout particles, not baked in here.
 */
export async function EventsHub({
  locale,
  viewer,
  viewRaw,
  thumbsRaw,
}: EventsHubProps) {
  const view: EventsHubView = parseEventsHubView(viewRaw)
  const settings = await getSiteSettings()
  const mapsEnabled = isCatalogModuleEnabled(settings, MODULE_IDS.maps)
  const listHref = withLocalePrefix('/events', locale)
  /** Thumbnails on by default; `?thumbs=0` turns them off. */
  const thumbsOff =
    (Array.isArray(thumbsRaw) ? thumbsRaw[0] : thumbsRaw) === '0'

  const { cards } = await loadPublicEventCards({
    locale,
    viewer,
    limit: 100,
  })

  let main: React.ReactNode
  switch (view) {
    case 'calendar':
      main = (
        <EventCalendarMonth
          events={cards}
          showThumbnails={!thumbsOff}
          thumbsToggle
        />
      )
      break
    case 'map':
      main = <EventsMapPanel events={cards} mapsEnabled={mapsEnabled} />
      break
    case 'list':
      main = <EventTableList events={cards} />
      break
    default:
      main = (
        <EventCardGrid
          events={cards}
          heading="Upcoming events"
          emptyMessage="No upcoming events."
        />
      )
  }

  return (
    <div className="sf-events-hub">
      <EventsViewTabs
        baseHref={listHref}
        active={view}
        showMap={mapsEnabled}
      />
      <div className="sf-events-hub-main-solo">{main}</div>
    </div>
  )
}
