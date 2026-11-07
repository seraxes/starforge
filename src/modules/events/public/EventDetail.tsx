import React from 'react'
import Link from 'next/link'

import type { EventPartyRecord, EventRecord } from '../types'
import { formatEventWhen } from './format'
import { eventPublicPathKey } from './path'
import { EventTicketTypes, type PublicTicketTier } from './EventTicketTypes'

export type RelatedEventLink = {
  id: string
  title: string
  slug: string
  href: string
}

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
    | 'galleryMediaIds'
    | 'capacity'
    | 'slug'
  >
  venueName?: string
  venueAddress?: string
  organizers?: EventPartyRecord[]
  speakers?: EventPartyRecord[]
  sponsors?: EventPartyRecord[]
  relatedEvents?: RelatedEventLink[]
  /** Ticket types for EB-style marketing block above registration. */
  ticketTiers?: PublicTicketTier[]
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
 * Public / particle event detail — schedule, venue, parties, related, ICS, description.
 */
export function EventDetail({
  event,
  venueName,
  venueAddress,
  organizers = [],
  speakers = [],
  sponsors = [],
  relatedEvents = [],
  ticketTiers = [],
  listHref,
  className = '',
}: EventDetailProps) {
  const classes = ['sf-event-detail', className].filter(Boolean).join(' ')
  const when = formatEventWhen(event.startsAt, event.endsAt, event.timezone)
  const icsHref = `/api/events/${encodeURIComponent(event.slug || event.id)}/ics`
  // Speakers fold into Organizers until role labels are editable.
  const organizerParties = (() => {
    const seen = new Set<string>()
    const out: EventPartyRecord[] = []
    for (const p of [...organizers, ...speakers]) {
      if (seen.has(p.id)) continue
      seen.add(p.id)
      out.push(p)
    }
    return out
  })()

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
      {(event.galleryMediaIds ?? []).length > 0 ? (
        <ul className="sf-event-detail-gallery" aria-label="Gallery">
          {(event.galleryMediaIds ?? []).map((id) => (
            <li key={id}>
              {/* eslint-disable-next-line @next/next/no-img-element -- Media library redirect */}
              <img src={`/api/media/${id}`} alt="" width={480} height={320} />
            </li>
          ))}
        </ul>
      ) : null}
      <PartyList label="Organizers" parties={organizerParties} />
      <PartyList label="Sponsors" parties={sponsors} />
      {relatedEvents.length > 0 ? (
        <section className="sf-event-detail-related" aria-label="Related events">
          <h2 className="sf-event-detail-parties-heading">Related events</h2>
          <ul className="sf-event-detail-related-list">
            {relatedEvents.map((rel) => (
              <li key={rel.id}>
                <Link href={rel.href}>{rel.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {event.description.trim() ? (
        <div
          className="sf-event-detail-description sf-rich-html"
          dangerouslySetInnerHTML={{ __html: event.description }}
        />
      ) : null}
      <EventTicketTypes tiers={ticketTiers} />
    </article>
  )
}

/** Build related links preserving order of `relatedEventIds`. */
export function relatedEventLinksFromRecords(
  ids: string[],
  byId: Map<string, Pick<EventRecord, 'id' | 'title' | 'slug'>>,
  hrefFor: (event: Pick<EventRecord, 'id' | 'slug'>) => string,
): RelatedEventLink[] {
  const out: RelatedEventLink[] = []
  for (const id of ids) {
    const row = byId.get(id)
    if (!row) continue
    out.push({
      id: row.id,
      title: row.title,
      slug: row.slug,
      href: hrefFor(row),
    })
  }
  return out
}

export function relatedHrefKey(event: Pick<EventRecord, 'id' | 'slug'>): string {
  return eventPublicPathKey(event)
}
