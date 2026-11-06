import React from 'react'
import Link from 'next/link'

import type { EventRecord } from '../types'
import { formatEventWhen } from './format'

export type EventDetailProps = {
  event: Pick<
    EventRecord,
    | 'id'
    | 'title'
    | 'startsAt'
    | 'endsAt'
    | 'timezone'
    | 'description'
    | 'coverMediaId'
    | 'capacity'
  >
  venueName?: string
  venueAddress?: string
  /** Locale-aware list href for back link. */
  listHref?: string
  className?: string
}

/**
 * Public / particle event detail — schedule, venue, sanitized HTML description.
 */
export function EventDetail({
  event,
  venueName,
  venueAddress,
  listHref,
  className = '',
}: EventDetailProps) {
  const classes = ['sf-event-detail', className].filter(Boolean).join(' ')
  const when = formatEventWhen(event.startsAt, event.endsAt, event.timezone)

  return (
    <article className={classes}>
      {listHref ? (
        <p className="sf-event-detail-back">
          <Link href={listHref}>← All events</Link>
        </p>
      ) : null}
      <header className="sf-event-detail-header">
        <h1 className="sf-event-detail-title">{event.title}</h1>
        {when ? <p className="sf-event-detail-when">{when}</p> : null}
        {venueName ? (
          <p className="sf-event-detail-venue">
            {venueName}
            {venueAddress ? ` — ${venueAddress}` : ''}
          </p>
        ) : null}
        {typeof event.capacity === 'number' ? (
          <p className="sf-event-detail-capacity">Capacity: {event.capacity}</p>
        ) : null}
      </header>
      {event.coverMediaId ? (
        // eslint-disable-next-line @next/next/no-img-element -- Media library redirect
        <img
          className="sf-event-detail-cover"
          src={`/api/media/${event.coverMediaId}`}
          alt=""
          width={960}
          height={540}
        />
      ) : null}
      {event.description.trim() ? (
        <div
          className="sf-event-detail-description sf-rich-html"
          dangerouslySetInnerHTML={{ __html: event.description }}
        />
      ) : null}
    </article>
  )
}
