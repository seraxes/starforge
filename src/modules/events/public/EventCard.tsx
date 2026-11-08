import React from 'react'
import Link from 'next/link'

import type { EventCardModel } from './event-card-model'

export type EventCardProps = {
  event: EventCardModel
  /** Larger featured tile. */
  featured?: boolean
  className?: string
}

function capacityLabel(event: EventCardModel): string | null {
  if (typeof event.capacity !== 'number') return null
  return `${event.occupied}/${event.capacity}`
}

function ctaLabel(event: EventCardModel): string {
  if (event.signupStatus === 'registered') return 'Already registered'
  if (event.signupStatus === 'waitlisted') return 'On waitlist'
  if (!event.registrationOpen) return 'Registration closed'
  if (event.remaining === 0) return 'Join waitlist'
  return 'Register'
}

/**
 * Public event discovery card — cover, when, venue, price, capacity, CTA.
 */
export function EventCard({ event, featured = false, className = '' }: EventCardProps) {
  const classes = [
    'sf-event-card',
    featured ? 'is-featured' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  const seats = capacityLabel(event)
  const signedUp = event.signupStatus !== 'none'

  return (
    <article className={classes}>
      <Link className="sf-event-card-media" href={event.href} tabIndex={-1} aria-hidden>
        {event.coverMediaId ? (
          // eslint-disable-next-line @next/next/no-img-element -- Media library redirect
          <img
            src={`/api/media/${encodeURIComponent(event.coverMediaId)}`}
            alt=""
            width={featured ? 640 : 480}
            height={featured ? 360 : 270}
          />
        ) : (
          <span className="sf-event-card-media-placeholder" />
        )}
      </Link>
      <div className="sf-event-card-body">
        <h3 className="sf-event-card-title">
          <Link href={event.href}>{event.title}</Link>
        </h3>
        {event.whenLabel ? (
          <p className="sf-event-card-meta">{event.whenLabel}</p>
        ) : null}
        {event.venueName ? (
          <p className="sf-event-card-meta">{event.venueName}</p>
        ) : null}
        <div className="sf-event-card-footer">
          {event.priceLabel ? (
            <span className="sf-event-card-price">{event.priceLabel}</span>
          ) : null}
          {seats ? <span className="sf-event-card-seats">{seats}</span> : null}
          {signedUp ? (
            <span className="sf-event-card-status">{ctaLabel(event)}</span>
          ) : (
            <Link
              className="sf-event-card-cta"
              href={event.registrationOpen ? `${event.href}#register` : event.href}
            >
              {ctaLabel(event)}
            </Link>
          )}
        </div>
      </div>
    </article>
  )
}
