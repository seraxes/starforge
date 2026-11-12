import React from 'react'
import Link from 'next/link'

import { buildEventsHubHref, type EventsHubView } from './EventsViewTabs'

export type EventsCategoryFilterOption = {
  slug: string
  title: string
}

type Props = {
  baseHref: string
  categories: EventsCategoryFilterOption[]
  activeSlug?: string
  view: EventsHubView
  thumbsOff?: boolean
}

/** Public hub category chips. Featured stays a separate carousel flag. */
export function EventsCategoryFilter({
  baseHref,
  categories,
  activeSlug,
  view,
  thumbsOff,
}: Props) {
  if (categories.length === 0) return null
  return (
    <nav className="sf-events-category-filter" aria-label="Event categories">
      <span className="sf-events-category-filter-label">Category</span>
      <Link
        href={buildEventsHubHref(baseHref, { view, thumbsOff })}
        className={`sf-events-view-tab${!activeSlug ? ' is-active' : ''}`}
        aria-current={!activeSlug ? 'page' : undefined}
      >
        All
      </Link>
      {categories.map((category) => {
        const isActive = category.slug === activeSlug
        return (
          <Link
            key={category.slug}
            href={buildEventsHubHref(baseHref, {
              view,
              category: category.slug,
              thumbsOff,
            })}
            className={`sf-events-view-tab${isActive ? ' is-active' : ''}`}
            aria-current={isActive ? 'page' : undefined}
          >
            {category.title}
          </Link>
        )
      })}
    </nav>
  )
}
