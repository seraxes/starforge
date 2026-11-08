import React from 'react'

import type { EventCardModel } from './event-card-model'
import { EventCard } from './EventCard'

type Props = {
  events: EventCardModel[]
  heading?: string
  emptyMessage?: string
}

/** Upcoming events mosaic. */
export function EventCardGrid({
  events,
  heading = 'Upcoming events',
  emptyMessage = 'No upcoming events.',
}: Props) {
  return (
    <section className="sf-events-grid-section" aria-label={heading}>
      {heading.trim() ? <h2 className="sf-events-section-heading">{heading}</h2> : null}
      {events.length === 0 ? (
        <p className="sf-event-list-empty">{emptyMessage}</p>
      ) : (
        <div className="sf-events-card-grid">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </section>
  )
}
