import React from 'react'
import Link from 'next/link'

import type { EventPartyRecord, EventRecord } from '../types'
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
    | 'slug'
  >
  venueName?: string
  venueAddress?: string
  organizers?: EventPartyRecord[]
  speakers?: EventPartyRecord[]
  sponsors?: EventPartyRecord[]
  /** Locale-aware list href for back link. */
  listHref?: string
  className?: string
}

function PartyList({
  label,
  parties,
}: {
  label: string
  parties: EventPartyRecord[]
}) {
  if (parties.length === 0) return null
  return (
    <section className="sf-event-detail-parties" aria-label={label}>
      <h2 className="sf-event-detail-parties-heading">{label}</h2>
      <ul className="sf-event-detail-party-list">
        {parties.map((p) => (
          <li key={p.id} className="sf-event-detail-party">
            {p.avatarMediaId ? (
              // eslint-disable-next-line @next/next/no-img-element -- Media library redirect
              <img
                className="sf-event-detail-party-avatar"
                src={`/api/media/${p.avatarMediaId}`}
                alt=""
                width={48}
                height={48}
              />
            ) : null}
            <div>
              {p.url ? (
                <a href={p.url} rel="noopener noreferrer">
                  {p.name}
                </a>
              ) : (
                <strong>{p.name}</strong>
              )}
              {p.blurb ? <p className="settings-hint">{p.blurb}</p> : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * Public / particle event detail — schedule, venue, parties, ICS, description.
 */
export function EventDetail({
  event,
  venueName,
  venueAddress,
  organizers = [],
  speakers = [],
  sponsors = [],
  listHref,
  className = '',
}: EventDetailProps) {
  const classes = ['sf-event-detail', className].filter(Boolean).join(' ')
  const when = formatEventWhen(event.startsAt, event.endsAt, event.timezone)
  const icsHref = `/api/events/${encodeURIComponent(event.slug || event.id)}/ics`

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
        {event.startsAt ? (
          <p className="sf-event-detail-ics">
            <a href={icsHref} download>
              Add to calendar (.ics)
            </a>
          </p>
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
      <PartyList label="Organizers" parties={organizers} />
      <PartyList label="Speakers" parties={speakers} />
      <PartyList label="Sponsors" parties={sponsors} />
      {event.description.trim() ? (
        <div
          className="sf-event-detail-description sf-rich-html"
          dangerouslySetInnerHTML={{ __html: event.description }}
        />
      ) : null}
    </article>
  )
}
