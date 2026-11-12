import React from 'react'
import Link from 'next/link'

import { isEventRegistrationOpen } from '../registrations'
import type { EventPartyRecord, EventRecord } from '../types'
import type { EventSignupStatus } from './event-card-model'
import {
  formatEventDate,
  formatEventTime,
  formatEventWhen,
} from './format'
import { eventPublicPathKey } from './path'
import type { TierCapacityDisplayMode } from '../types'
import { EventTicketTypes } from './EventTicketTypes'
import type { PublicTicketTier } from './ticket-tier-model'

export type RelatedEventLink = {
  id: string
  title: string
  slug: string
  href: string
}

export type EventDetailLocation = {
  name?: string
  address?: string
  latitude?: number | null
  longitude?: number | null
  /** Pre-rendered map (e.g. EventVenueMap). */
  map?: React.ReactNode
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
    | 'status'
    | 'registrationOpensAt'
    | 'registrationClosesAt'
  >
  venueName?: string
  venueAddress?: string
  location?: EventDetailLocation
  organizers?: EventPartyRecord[]
  speakers?: EventPartyRecord[]
  sponsors?: EventPartyRecord[]
  relatedEvents?: RelatedEventLink[]
  /** Ticket types for EB-style marketing block above registration. */
  ticketTiers?: PublicTicketTier[]
  /** Locale-aware list href for back link. */
  listHref?: string
  occupied?: number
  signupStatus?: EventSignupStatus
  /** Pre-resolved cover URL (preferred over `/api/media/:id`). */
  coverSrc?: string
  className?: string
  /** How area cards show capacity (module setting). */
  tierCapacityDisplay?: TierCapacityDisplayMode
  /** Locale-prefixed public event path for area-card Register redirects. */
  eventPath?: string
  /** Locale-prefixed login path (`/en/login`). */
  loginPath?: string
  /** Active signup ticket tier id when signed up (for Edit/Cancel vs Switch to). */
  activeTierId?: string
  /** True when self-cancel / Switch-to window is open. */
  selfCancelOpen?: boolean
  /** True when the active signup is unpaid (Switch-to allowed). */
  canSwitchTier?: boolean
  /** Locale-prefixed manage-my-signup path. */
  manageHref?: string
  /** Active registration id for Switch-to. */
  registrationId?: string
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
      <h2 className="sf-event-detail-section-heading">{label}</h2>
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

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  if (children == null || children === '') return null
  return (
    <div className="sf-event-detail-data-row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

/**
 * Public / particle event detail — ASN-style sections on Starforge public chrome.
 */
export function EventDetail({
  event,
  venueName,
  venueAddress,
  location,
  organizers = [],
  speakers = [],
  sponsors = [],
  relatedEvents = [],
  ticketTiers = [],
  listHref,
  occupied,
  signupStatus = 'none',
  coverSrc,
  className = '',
  tierCapacityDisplay = 'both',
  eventPath = '',
  loginPath = '',
  activeTierId = '',
  selfCancelOpen = false,
  canSwitchTier = false,
  manageHref = '',
  registrationId = '',
}: EventDetailProps) {
  const classes = ['sf-event-detail', className].filter(Boolean).join(' ')
  const when = formatEventWhen(event.startsAt, event.endsAt, event.timezone)
  const startTime = formatEventTime(event.startsAt, event.timezone)
  const endTime = formatEventTime(event.endsAt, event.timezone)
  const startDate = formatEventDate(event.startsAt, event.timezone)
  const icsHref = `/api/events/${encodeURIComponent(event.slug || event.id)}/ics`
  const regWindow = isEventRegistrationOpen(event)
  const placeName = location?.name || venueName || ''
  const placeAddress = location?.address || venueAddress || ''
  const coverUrl =
    (coverSrc || '').trim() ||
    (event.coverMediaId
      ? `/api/media/${encodeURIComponent(event.coverMediaId)}`
      : '')

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

  const organizerLabel = organizerParties.map((p) => p.name).filter(Boolean).join(', ')
  const remaining =
    typeof event.capacity === 'number' && typeof occupied === 'number'
      ? Math.max(0, event.capacity - occupied)
      : null

  const signedUp = signupStatus !== 'none'

  return (
    <article className={classes}>
      {listHref ? (
        <p className="sf-event-detail-back">
          <Link href={listHref}>← All events</Link>
        </p>
      ) : null}

      <header className="sf-event-detail-header">
        <h1 className="sf-event-detail-title">{event.title}</h1>
        <p className="sf-event-detail-meta">
          {[
            organizerLabel ? `Organizer: ${organizerLabel}` : '',
            placeName ? `Venue: ${placeName}` : '',
            startDate ? `Date: ${startDate}` : when ? `When: ${when}` : '',
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <div className="sf-event-detail-badges">
          {event.status === 'published' ? (
            <span className="sf-event-detail-badge">Published</span>
          ) : null}
          {regWindow.open ? (
            <span className="sf-event-detail-badge is-open">Registration open</span>
          ) : (
            <span className="sf-event-detail-badge is-closed">
              {regWindow.reason || 'Registration closed'}
            </span>
          )}
          {signedUp ? (
            <span className="sf-event-detail-badge is-signed">
              {signupStatus === 'waitlisted' ? 'On waitlist' : 'Registered'}
            </span>
          ) : null}
        </div>
      </header>

      {coverUrl ? (
        <figure className="sf-event-detail-cover-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element -- Media library / resolved URL */}
          <img
            className="sf-event-detail-cover"
            src={coverUrl}
            alt=""
            width={1200}
            height={540}
          />
        </figure>
      ) : null}

      <section className="sf-event-detail-actions" aria-label="Quick actions">
        {signedUp && manageHref ? (
          <a className="sf-event-detail-action is-primary" href={manageHref}>
            Edit / Cancel registration
          </a>
        ) : signedUp ? (
          <span className="sf-event-detail-action is-status">
            {signupStatus === 'waitlisted'
              ? 'You are on the waitlist'
              : 'You are already registered'}
          </span>
        ) : regWindow.open ? (
          <a className="sf-event-detail-action is-primary" href="#register">
            Register
          </a>
        ) : (
          <span className="sf-event-detail-action is-muted">Registration closed</span>
        )}
        {event.startsAt ? (
          <a className="sf-event-detail-action" href={icsHref} download>
            Add to calendar
          </a>
        ) : null}
      </section>

      {event.description.trim() ? (
        <section className="sf-event-detail-section" aria-label="Description">
          <h2 className="sf-event-detail-section-heading">Description</h2>
          <div
            className="sf-event-detail-description sf-rich-html"
            dangerouslySetInnerHTML={{ __html: event.description }}
          />
        </section>
      ) : null}

      <section className="sf-event-detail-section" aria-label="Event details">
        <h2 className="sf-event-detail-section-heading">Details</h2>
        <dl className="sf-event-detail-data">
          <DetailRow label="Start">{startTime || '—'}</DetailRow>
          <DetailRow label="End">{endTime || '—'}</DetailRow>
          <DetailRow label="Date">{startDate || when || '—'}</DetailRow>
          {typeof event.capacity === 'number' ? (
            <DetailRow label="Capacity">
              {typeof occupied === 'number'
                ? `${occupied} / ${event.capacity}`
                : String(event.capacity)}
              {remaining != null ? ` (${remaining} free)` : ''}
            </DetailRow>
          ) : null}
          {event.registrationOpensAt ? (
            <DetailRow label="Registration opens">
              {formatEventWhen(event.registrationOpensAt, null, event.timezone)}
            </DetailRow>
          ) : null}
          {event.registrationClosesAt ? (
            <DetailRow label="Registration closes">
              {formatEventWhen(event.registrationClosesAt, null, event.timezone)}
            </DetailRow>
          ) : null}
          {organizerLabel ? (
            <DetailRow label="Organizer">{organizerLabel}</DetailRow>
          ) : null}
        </dl>
      </section>

      {ticketTiers.length > 0 && eventPath && loginPath ? (
        <EventTicketTypes
          tiers={ticketTiers}
          eventId={event.id}
          eventPath={eventPath}
          loginPath={loginPath}
          capacityDisplay={tierCapacityDisplay}
          registrationOpen={regWindow.open}
          signupStatus={signupStatus}
          activeTierId={activeTierId}
          selfCancelOpen={selfCancelOpen}
          canSwitchTier={canSwitchTier}
          manageHref={manageHref}
          registrationId={registrationId}
        />
      ) : null}

      {placeName || placeAddress || location?.map ? (
        <section className="sf-event-detail-section" aria-label="Location">
          <h2 className="sf-event-detail-section-heading">Location</h2>
          {placeName ? <p className="sf-event-detail-venue">{placeName}</p> : null}
          {placeAddress ? (
            <p className="sf-event-detail-venue-address settings-hint">{placeAddress}</p>
          ) : null}
          {location?.latitude != null && location?.longitude != null ? (
            <p className="sf-event-detail-coords settings-hint">
              GPS: {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
            </p>
          ) : null}
          {location?.map}
        </section>
      ) : null}

      <PartyList label="Organizers" parties={organizerParties} />
      <PartyList label="Sponsors" parties={sponsors} />

      {relatedEvents.length > 0 ? (
        <section className="sf-event-detail-related" aria-label="Related events">
          <h2 className="sf-event-detail-section-heading">Related events</h2>
          <ul className="sf-event-detail-related-list">
            {relatedEvents.map((rel) => (
              <li key={rel.id}>
                <Link href={rel.href}>{rel.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {(event.galleryMediaIds ?? []).length > 0 ? (
        <section className="sf-event-detail-section" aria-label="Gallery">
          <h2 className="sf-event-detail-section-heading">Gallery</h2>
          <ul className="sf-event-detail-gallery">
            {(event.galleryMediaIds ?? []).map((id) => (
              <li key={id}>
                {/* eslint-disable-next-line @next/next/no-img-element -- Media library redirect */}
                <img src={`/api/media/${id}`} alt="" width={480} height={320} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
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
