import React from 'react'
import Link from 'next/link'

import type { EventRecord } from '../types'
import { formatEventWhen } from './format'
import { eventPublicPathKey } from './path'

export type EventListItem = Pick<
  EventRecord,
  'id' | 'title' | 'slug' | 'startsAt' | 'endsAt' | 'timezone' | 'coverMediaId' | 'capacity'
> & {
  venueName?: string
}

export type EventListProps = {
  events: EventListItem[]
  heading?: string
  emptyMessage?: string
  /** Locale-aware base path, e.g. `/en/events`. */
  listHref: string
  className?: string
}

/**
 * Public / particle event list — links to `/events/[slug|id]`.
 */
export function EventList({
  events,
  heading = '',
  emptyMessage = 'No upcoming events.',
  listHref,
  className = '',
}: EventListProps) {
  const classes = ['sf-event-list', className].filter(Boolean).join(' ')
  const base = listHref.replace(/\/$/, '')

  return (
    <div className={classes}>
      {heading.trim() ? <h2 className="sf-event-list-heading">{heading.trim()}</h2> : null}
      {events.length === 0 ? (
        <p className="sf-event-list-empty">{emptyMessage}</p>
      ) : (
        <ul className="sf-event-list-items">
          {events.map((event) => {
            const when = formatEventWhen(event.startsAt, event.endsAt, event.timezone)
            const href = `${base}/${encodeURIComponent(eventPublicPathKey(event))}`
            return (
              <li key={event.id} className="sf-event-list-item">
                {event.coverMediaId ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Media library redirect
                  <img
                    className="sf-event-list-cover"
                    src={`/api/media/${event.coverMediaId}`}
                    alt=""
                    width={96}
                    height={64}
                  />
                ) : null}
                <div className="sf-event-list-body">
                  <Link className="sf-event-list-title" href={href}>
                    {event.title}
                  </Link>
                  {when ? <p className="sf-event-list-when">{when}</p> : null}
                  {event.venueName ? (
                    <p className="sf-event-list-venue">{event.venueName}</p>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
