import React from 'react'
import Link from 'next/link'

export const EVENTS_HUB_VIEWS = ['upcoming', 'calendar', 'map', 'list'] as const

export type EventsHubView = (typeof EVENTS_HUB_VIEWS)[number]

export function parseEventsHubView(raw: string | string[] | undefined): EventsHubView {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (value && (EVENTS_HUB_VIEWS as readonly string[]).includes(value)) {
    return value as EventsHubView
  }
  return 'upcoming'
}

const LABELS: Record<EventsHubView, string> = {
  upcoming: 'Upcoming',
  calendar: 'Calendar',
  map: 'Map',
  list: 'List',
}

type HubQuery = {
  view?: EventsHubView
  category?: string
  thumbsOff?: boolean
}

/** Hub links keep the view, category filter, and thumbnail flag together. */
export function buildEventsHubHref(baseHref: string, opts: HubQuery = {}): string {
  const params = new URLSearchParams()
  if (opts.view && opts.view !== 'upcoming') params.set('view', opts.view)
  if (opts.category) params.set('category', opts.category)
  if (opts.thumbsOff) params.set('thumbs', '0')
  const query = params.toString()
  const base = baseHref.split('?')[0] || baseHref
  return query ? `${base}?${query}` : base
}

type Props = {
  baseHref: string
  active: EventsHubView
  /** Hide map tab when Maps module is off. */
  showMap?: boolean
  category?: string
  thumbsOff?: boolean
}

/** Hub view switcher — `?view=` like Media library. */
export function EventsViewTabs({
  baseHref,
  active,
  showMap = true,
  category,
  thumbsOff,
}: Props) {
  const views = EVENTS_HUB_VIEWS.filter((v) => showMap || v !== 'map')
  return (
    <nav className="sf-events-view-tabs" aria-label="Events views">
      {views.map((view) => {
        const href = buildEventsHubHref(baseHref, { view, category, thumbsOff })
        const isActive = view === active
        return (
          <Link
            key={view}
            href={href}
            className={`sf-events-view-tab${isActive ? ' is-active' : ''}`}
            aria-current={isActive ? 'page' : undefined}
          >
            {LABELS[view]}
          </Link>
        )
      })}
    </nav>
  )
}
