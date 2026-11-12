import React from 'react'

import type { AccessViewer } from '@/core/acl/types'
import type { AppLocale } from '@/core/i18n/locales'
import { withLocalePrefix } from '@/core/i18n/path'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import {
  categoryAllowsViewer,
  listEventCategories,
  publicCategoryLabel,
} from '../categories'
import { EventCalendarMonth } from './EventCalendarMonth'
import { EventCardGrid } from './EventCardGrid'
import { EventTableList } from './EventTableList'
import { EventsCategoryFilter } from './EventsCategoryFilter'
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
  /** Category slug from `?category=`. */
  categoryRaw?: string | string[]
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
  categoryRaw,
}: EventsHubProps) {
  const view: EventsHubView = parseEventsHubView(viewRaw)
  const settings = await getSiteSettings()
  const mapsEnabled = isCatalogModuleEnabled(settings, MODULE_IDS.maps)
  const listHref = withLocalePrefix('/events', locale)
  /** Thumbnails on by default; `?thumbs=0` turns them off. */
  const thumbsOff =
    (Array.isArray(thumbsRaw) ? thumbsRaw[0] : thumbsRaw) === '0'
  const requestedCategory = (
    (Array.isArray(categoryRaw) ? categoryRaw[0] : categoryRaw) || ''
  ).trim()

  const categories = await listEventCategories()
  const visibleCategories = []
  for (const category of categories) {
    if (!categoryAllowsViewer(category.id, category, viewer)) continue
    const label = await publicCategoryLabel(category, locale)
    visibleCategories.push({
      id: category.id,
      slug: category.slug,
      title: label.title,
    })
  }
  const selected = requestedCategory
    ? visibleCategories.find((category) => category.slug === requestedCategory)
    : undefined
  const categoryMissing = Boolean(requestedCategory) && !selected

  const { cards } = await loadPublicEventCards({
    locale,
    viewer,
    limit: 100,
    categoryId: categoryMissing ? '__none__' : selected?.id,
  })
  const emptyMessage = selected
    ? `No upcoming events in ${selected.title}.`
    : categoryMissing
      ? 'No upcoming events in this category.'
      : 'No upcoming events.'

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
      main = <EventTableList events={cards} emptyMessage={emptyMessage} />
      break
    default:
      main = (
        <EventCardGrid
          events={cards}
          heading="Upcoming events"
          emptyMessage={emptyMessage}
        />
      )
  }

  return (
    <div className="sf-events-hub">
      <EventsViewTabs
        baseHref={listHref}
        active={view}
        showMap={mapsEnabled}
        category={selected?.slug}
        thumbsOff={thumbsOff}
      />
      <EventsCategoryFilter
        baseHref={listHref}
        categories={visibleCategories}
        activeSlug={selected?.slug}
        view={view}
        thumbsOff={thumbsOff}
      />
      <div className="sf-events-hub-main-solo">{main}</div>
    </div>
  )
}
