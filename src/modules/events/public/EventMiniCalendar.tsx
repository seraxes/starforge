'use client'

import React, { useMemo } from 'react'
import Link from 'next/link'

import type { EventCardModel } from './event-card-model'

type Props = {
  events: EventCardModel[]
  heading?: string
  /** Link for “view calendar” (optional). */
  calendarHref?: string
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Compact month overview — layout particle (not baked into Events hub).
 */
export function EventMiniCalendar({
  events,
  heading,
  calendarHref,
}: Props) {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7
  const label =
    heading?.trim() ||
    now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  const byDay = useMemo(() => {
    const map = new Map<string, EventCardModel[]>()
    for (const event of events) {
      if (!event.startsAt) continue
      const key = ymd(event.startsAt)
      const list = map.get(key) ?? []
      list.push(event)
      map.set(key, list)
    }
    return map
  }, [events])

  const cells: Array<number | null> = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const upcoming = [...events]
    .filter((e) => e.startsAt && e.startsAt >= new Date(year, month, 1))
    .slice(0, 6)

  return (
    <aside className="sf-event-mini-calendar" aria-label={label}>
      <p className="sf-events-sidebar-heading">{label}</p>
      <div className="sf-events-mini-cal-weekdays" aria-hidden>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={`${d}-${i}`}>{d}</span>
        ))}
      </div>
      <div className="sf-events-mini-cal-grid">
        {cells.map((day, i) => {
          if (day == null) {
            return <span key={`e-${i}`} className="sf-events-mini-cal-day is-empty" />
          }
          const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const dayEvents = byDay.get(key) ?? []
          const first = dayEvents[0]
          const className = `sf-events-mini-cal-day${dayEvents.length ? ' has-event' : ''}`
          if (first) {
            return (
              <Link key={key} href={first.href} className={className} title={first.title}>
                {day}
              </Link>
            )
          }
          return (
            <span key={key} className={className}>
              {day}
            </span>
          )
        })}
      </div>
      {upcoming.length > 0 ? (
        <ul className="sf-event-mini-calendar-list">
          {upcoming.map((event) => (
            <li key={event.id}>
              <Link href={event.href}>
                <span className="sf-event-mini-calendar-date">
                  {event.startsAt
                    ? event.startsAt.toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })
                    : ''}
                </span>
                <span className="sf-event-mini-calendar-title">{event.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {calendarHref ? (
        <p className="sf-event-mini-calendar-more">
          <Link href={calendarHref}>Open calendar</Link>
        </p>
      ) : null}
    </aside>
  )
}
