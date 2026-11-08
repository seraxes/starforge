'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'

import type { EventCardModel } from './event-card-model'

type Props = {
  events: EventCardModel[]
  heading?: string
  /** Auto-advance interval in ms (0 = off). */
  intervalMs?: number
}

/**
 * Rotating featured strip — layout particle; driven by event.featured.
 */
export function EventFeaturedCarousel({
  events,
  heading = 'Featured',
  intervalMs = 6000,
}: Props) {
  const [index, setIndex] = useState(0)
  const count = events.length

  useEffect(() => {
    if (count <= 1 || intervalMs <= 0) return
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % count)
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [count, intervalMs])

  if (count === 0) return null

  const active = events[Math.min(index, count - 1)]!

  return (
    <section className="sf-event-featured-carousel" aria-roledescription="carousel" aria-label={heading}>
      {heading.trim() ? (
        <h2 className="sf-events-section-heading">{heading.trim()}</h2>
      ) : null}
      <div className="sf-event-featured-carousel-stage">
        <Link
          className="sf-event-featured-carousel-slide"
          href={active.href}
          aria-label={active.title}
        >
          {active.coverMediaId ? (
            // eslint-disable-next-line @next/next/no-img-element -- Media library redirect
            <img
              src={`/api/media/${active.coverMediaId}`}
              alt=""
              width={1200}
              height={520}
            />
          ) : (
            <span className="sf-event-featured-carousel-fallback" />
          )}
          <div className="sf-event-featured-carousel-caption">
            <p className="sf-event-featured-carousel-title">{active.title}</p>
            {active.whenLabel ? (
              <p className="sf-event-featured-carousel-meta">{active.whenLabel}</p>
            ) : null}
            {active.venueName ? (
              <p className="sf-event-featured-carousel-meta">{active.venueName}</p>
            ) : null}
            {typeof active.capacity === 'number' ? (
              <p className="sf-event-featured-carousel-meta">
                {active.occupied}/{active.capacity}
              </p>
            ) : null}
          </div>
        </Link>
        {count > 1 ? (
          <div className="sf-event-featured-carousel-dots" role="tablist" aria-label="Slides">
            {events.map((event, i) => (
              <button
                key={event.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                className={`sf-event-featured-carousel-dot${i === index ? ' is-active' : ''}`}
                onClick={() => setIndex(i)}
              >
                <span className="sr-only">{event.title}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {count > 1 ? (
        <div className="sf-event-featured-carousel-strip" aria-hidden>
          {events.map((event, i) => (
            <button
              key={event.id}
              type="button"
              className={`sf-event-featured-carousel-thumb${i === index ? ' is-active' : ''}`}
              onClick={() => setIndex(i)}
            >
              {event.coverMediaId ? (
                // eslint-disable-next-line @next/next/no-img-element -- Media library redirect
                <img src={`/api/media/${event.coverMediaId}`} alt="" width={120} height={68} />
              ) : (
                <span>{event.title}</span>
              )}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  )
}
