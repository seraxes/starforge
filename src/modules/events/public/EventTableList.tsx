import React from 'react'
import Link from 'next/link'

import type { EventCardModel } from './event-card-model'
import { signupCtaLabel } from './signup-status'

type Props = {
  events: EventCardModel[]
  emptyMessage?: string
}

function freeSpots(event: EventCardModel): string {
  if (typeof event.capacity !== 'number') return '—'
  if (event.remaining == null) return '—'
  return String(event.remaining)
}

function actionCell(event: EventCardModel) {
  if (event.signupStatus !== 'none') {
    return <span className="sf-events-table-status">{signupCtaLabel(event.signupStatus)}</span>
  }
  if (!event.registrationOpen) {
    return <span className="sf-events-table-status is-muted">Closed</span>
  }
  return (
    <Link className="sf-event-card-cta" href={`${event.href}#register`}>
      {event.remaining === 0 ? 'Waitlist' : 'Register'}
    </Link>
  )
}

/** Dense listing table (ASN list view, modernized). */
export function EventTableList({
  events,
  emptyMessage = 'No upcoming events.',
}: Props) {
  if (events.length === 0) {
    return <p className="sf-event-list-empty">{emptyMessage}</p>
  }
  return (
    <div className="sf-events-table-wrap">
      <table className="sf-events-table">
        <thead>
          <tr>
            <th scope="col">Event</th>
            <th scope="col">Category</th>
            <th scope="col">When</th>
            <th scope="col">Venue</th>
            <th scope="col">Capacity</th>
            <th scope="col">Registered</th>
            <th scope="col">Free</th>
            <th scope="col">Registration</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id}>
              <td>
                <Link className="sf-events-table-title" href={event.href}>
                  {event.title}
                </Link>
              </td>
              <td>
                {event.categoryTitle ? (
                  event.categoryHref ? (
                    <Link href={event.categoryHref}>{event.categoryTitle}</Link>
                  ) : (
                    event.categoryTitle
                  )
                ) : (
                  '—'
                )}
              </td>
              <td>{event.whenLabel || '—'}</td>
              <td>{event.venueName || '—'}</td>
              <td>{typeof event.capacity === 'number' ? event.capacity : '—'}</td>
              <td>{event.occupied}</td>
              <td>{freeSpots(event)}</td>
              <td>{actionCell(event)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
