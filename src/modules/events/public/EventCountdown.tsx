'use client'

import React, { useEffect, useState } from 'react'

type Props = {
  /** ISO start time. */
  startsAt: string
  title?: string
  className?: string
}

function partsUntil(targetMs: number, nowMs: number) {
  const diff = Math.max(0, targetMs - nowMs)
  const sec = Math.floor(diff / 1000)
  const days = Math.floor(sec / 86400)
  const hours = Math.floor((sec % 86400) / 3600)
  const minutes = Math.floor((sec % 3600) / 60)
  const seconds = sec % 60
  return { days, hours, minutes, seconds, done: diff <= 0 }
}

/**
 * Live countdown to an event start (client tick).
 */
export function EventCountdown({ startsAt, title, className = '' }: Props) {
  const target = new Date(startsAt).getTime()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (Number.isNaN(target)) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [target])

  if (Number.isNaN(target)) {
    return (
      <p className={['sf-event-countdown', className].filter(Boolean).join(' ')}>
        No start time.
      </p>
    )
  }

  const p = partsUntil(target, now)
  const classes = ['sf-event-countdown', className].filter(Boolean).join(' ')

  return (
    <div className={classes} aria-live="polite">
      {title ? <p className="sf-event-countdown-title">{title}</p> : null}
      {p.done ? (
        <p className="sf-event-countdown-done">Event has started.</p>
      ) : (
        <p className="sf-event-countdown-digits">
          <span>
            <strong>{p.days}</strong>d
          </span>{' '}
          <span>
            <strong>{p.hours}</strong>h
          </span>{' '}
          <span>
            <strong>{p.minutes}</strong>m
          </span>{' '}
          <span>
            <strong>{p.seconds}</strong>s
          </span>
        </p>
      )}
    </div>
  )
}
