'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

import type { EventCardModel } from './event-card-model'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MAX_PER_DAY = 3

type Props = {
  events: EventCardModel[]
  /** Initial month as YYYY-MM (optional). */
  initialMonth?: string
  /** Show cover thumbnails on day cells (default on). */
  showThumbnails?: boolean
  /** When true, render a thumbs on/off control that syncs `?thumbs=`. */
  thumbsToggle?: boolean
}

function ymdLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Calendar day key in the event's timezone (avoids UTC day drift). */
function ymdInTimezone(d: Date, timeZone: string): string {
  const tz = (timeZone || '').trim() || 'UTC'
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(d)
    const y = parts.find((p) => p.type === 'year')?.value
    const m = parts.find((p) => p.type === 'month')?.value
    const day = parts.find((p) => p.type === 'day')?.value
    if (y && m && day) return `${y}-${m}-${day}`
  } catch {
    // fall through
  }
  return ymdLocal(d)
}

function parseMonthKey(raw: string | undefined): Date {
  if (raw && /^\d{4}-\d{2}$/.test(raw)) {
    const [y, m] = raw.split('-').map(Number)
    return new Date(y, m - 1, 1)
  }
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

function addMonths(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1)
}

function buildCells(monthStart: Date): Array<{ date: Date | null; key: string }> {
  const year = monthStart.getFullYear()
  const month = monthStart.getMonth()
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: Array<{ date: Date | null; key: string }> = []
  for (let i = 0; i < firstDow; i++) {
    cells.push({ date: null, key: `pad-${i}` })
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day)
    cells.push({ date, key: ymdLocal(date) })
  }
  while (cells.length % 7 !== 0) {
    cells.push({ date: null, key: `trail-${cells.length}` })
  }
  return cells
}

function seatsLabel(event: EventCardModel): string | null {
  if (typeof event.capacity !== 'number') return null
  return `${event.occupied}/${event.capacity}`
}

function coverUrl(event: EventCardModel): string {
  if (event.coverMediaId) {
    return `/api/media/${encodeURIComponent(event.coverMediaId)}`
  }
  return ''
}

function IconUsers({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="12"
      height="12"
      aria-hidden
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-3.3 0-6 1.7-6 3.5V19h12v-1.5C18 15.7 15.3 14 12 14Z"
      />
    </svg>
  )
}

function IconLandmark({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="12"
      height="12"
      aria-hidden
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M12 2C8.7 2 6 4.7 6 8c0 4.5 6 12 6 12s6-7.5 6-12c0-3.3-2.7-6-6-6Zm0 8.5A2.5 2.5 0 1 1 12 5a2.5 2.5 0 0 1 0 5.5Z"
      />
    </svg>
  )
}

/**
 * Month grid — title, seats (x/y), venue, cover thumb (on by default).
 */
export function EventCalendarMonth({
  events,
  initialMonth,
  showThumbnails: showThumbnailsProp = true,
  thumbsToggle = false,
}: Props) {
  const [cursor, setCursor] = useState(() => parseMonthKey(initialMonth))
  const [thumbsOn, setThumbsOn] = useState(showThumbnailsProp !== false)
  const router = useRouter()
  const pathname = usePathname()
  const showThumbnails = thumbsToggle ? thumbsOn : showThumbnailsProp !== false

  const byDay = useMemo(() => {
    const map = new Map<string, EventCardModel[]>()
    for (const event of events) {
      if (!event.startsAt) continue
      const key = ymdInTimezone(event.startsAt, event.timezone)
      const list = map.get(key) ?? []
      list.push(event)
      map.set(key, list)
    }
    return map
  }, [events])

  const cells = useMemo(() => buildCells(cursor), [cursor])
  const label = cursor.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })

  const setThumbs = (on: boolean) => {
    setThumbsOn(on)
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    if (on) url.searchParams.delete('thumbs')
    else url.searchParams.set('thumbs', '0')
    router.replace(`${pathname}${url.search}`, { scroll: false })
  }

  return (
    <section className="sf-events-calendar" aria-label="Event calendar">
      <div className="sf-events-calendar-toolbar">
        <button
          type="button"
          className="sf-events-view-btn"
          onClick={() => setCursor((c) => addMonths(c, -1))}
          aria-label="Previous month"
        >
          ‹
        </button>
        <h2 className="sf-events-section-heading sf-events-calendar-title">{label}</h2>
        <button
          type="button"
          className="sf-events-view-btn"
          onClick={() => setCursor((c) => addMonths(c, 1))}
          aria-label="Next month"
        >
          ›
        </button>
      </div>
      {thumbsToggle ? (
        <label className="sf-events-calendar-thumbs-toggle settings-field-checkbox">
          <input
            type="checkbox"
            checked={showThumbnails}
            onChange={(e) => setThumbs(e.target.checked)}
          />
          <span>Show thumbnails</span>
        </label>
      ) : null}
      <div className="sf-events-calendar-weekdays" aria-hidden>
        {WEEKDAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="sf-events-calendar-grid">
        {cells.map((cell) => {
          if (!cell.date) {
            return <div key={cell.key} className="sf-events-calendar-cell is-empty" />
          }
          const dayEvents = byDay.get(cell.key) ?? []
          const visible = dayEvents.slice(0, MAX_PER_DAY)
          const more = dayEvents.length - visible.length
          return (
            <div key={cell.key} className="sf-events-calendar-cell">
              <span className="sf-events-calendar-day">{cell.date.getDate()}</span>
              <ul className="sf-events-calendar-events">
                {visible.map((event) => {
                  const seats = seatsLabel(event)
                  const thumb = showThumbnails ? coverUrl(event) : ''
                  return (
                    <li key={event.id}>
                      <Link
                        href={event.href}
                        className={`sf-events-calendar-event${thumb ? ' has-cover' : ''}`}
                      >
                        {thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element -- Media library redirect
                          <img
                            className="sf-events-calendar-event-cover"
                            src={thumb}
                            alt=""
                            width={320}
                            height={180}
                          />
                        ) : null}
                        <span className="sf-events-calendar-event-title">
                          {event.title}
                        </span>
                        {seats ? (
                          <span className="sf-events-calendar-event-seats">
                            <IconUsers className="sf-events-calendar-event-icon" />
                            <span>{seats}</span>
                          </span>
                        ) : null}
                        {event.venueName ? (
                          <span className="sf-events-calendar-event-venue">
                            <IconLandmark className="sf-events-calendar-event-icon" />
                            <span>{event.venueName}</span>
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  )
                })}
              </ul>
              {more > 0 ? (
                <p className="sf-events-calendar-more settings-hint">+{more} more</p>
              ) : null}
            </div>
          )
        })}
      </div>
    </section>
  )
}
