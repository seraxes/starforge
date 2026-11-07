/**
 * Build a minimal ICS calendar document from an event (Wave C).
 */

import type { EventRecord } from '../types'

function pad(n: number) {
  return String(n).padStart(2, '0')
}

/** UTC stamp `YYYYMMDDTHHMMSSZ`. */
export function toIcsUtc(date: Date): string {
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  )
}

function escapeIcsText(raw: string): string {
  return raw
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

export function buildEventIcs(
  event: Pick<
    EventRecord,
    'id' | 'title' | 'description' | 'startsAt' | 'endsAt' | 'timezone'
  >,
  options?: { venueLine?: string; url?: string },
): string | null {
  if (!event.startsAt) return null
  const dtStart = toIcsUtc(event.startsAt)
  const dtEnd = toIcsUtc(event.endsAt && event.endsAt > event.startsAt ? event.endsAt : event.startsAt)
  const uid = `${event.id}@starforge-events`
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Starforge//Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toIcsUtc(new Date())}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
  ]
  const desc = (event.description || '').replace(/<[^>]+>/g, ' ').trim()
  if (desc) lines.push(`DESCRIPTION:${escapeIcsText(desc.slice(0, 1800))}`)
  if (options?.venueLine) lines.push(`LOCATION:${escapeIcsText(options.venueLine)}`)
  if (options?.url) lines.push(`URL:${escapeIcsText(options.url)}`)
  lines.push('END:VEVENT', 'END:VCALENDAR')
  return `${lines.join('\r\n')}\r\n`
}
