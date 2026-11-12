/**
 * Door check-in QR / ticket URLs (product:events).
 * QR encodes the admin check-in deep link; attendees show the ticket at the door.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

const TICKET_SIG_PREFIX = 'sf-events-ticket-v1:'

function appOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.BETTER_AUTH_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '')
}

function ticketSecret(): string | null {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret || !secret.trim()) return null
  return secret
}

/** Relative admin path staff open after scanning the attendee QR. */
export function buildDoorCheckInPath(eventId: string, registrationId: string): string {
  const eid = eventId.trim()
  const rid = registrationId.trim()
  const q = new URLSearchParams()
  if (eid) q.set('eventId', eid)
  if (rid) q.set('registrationId', rid)
  const qs = q.toString()
  return qs ? `/admin/events/check-in?${qs}` : '/admin/events/check-in'
}

/** Absolute admin check-in URL (QR payload). */
export function buildDoorCheckInAbsoluteUrl(
  eventId: string,
  registrationId: string,
): string {
  return `${appOrigin()}${buildDoorCheckInPath(eventId, registrationId)}`
}

/** HMAC signature so ticket pages stay unguessable without a DB token column. */
export function signRegistrationTicketToken(registrationId: string): string | null {
  const secret = ticketSecret()
  const id = registrationId.trim()
  if (!secret || !id) return null
  return createHmac('sha256', secret)
    .update(`${TICKET_SIG_PREFIX}${id}`)
    .digest('base64url')
}

export function verifyRegistrationTicketToken(
  registrationId: string,
  token: string | null | undefined,
): boolean {
  const expected = signRegistrationTicketToken(registrationId)
  const got = (token || '').trim()
  if (!expected || !got) return false
  try {
    const a = Buffer.from(expected)
    const b = Buffer.from(got)
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

/** Locale-prefixed public ticket path (`/[locale]/events/ticket/:id?t=`). */
export function buildRegistrationTicketPath(
  locale: string,
  registrationId: string,
  token?: string | null,
): string | null {
  const id = registrationId.trim()
  if (!id) return null
  const sig = (token || '').trim() || signRegistrationTicketToken(id)
  if (!sig) return null
  const loc = (locale || '').trim() || 'en'
  return `/${encodeURIComponent(loc)}/events/ticket/${encodeURIComponent(id)}?t=${encodeURIComponent(sig)}`
}

/** Absolute ticket URL for Email Manager merge fields. */
export function buildRegistrationTicketAbsoluteUrl(
  locale: string,
  registrationId: string,
): string | null {
  const path = buildRegistrationTicketPath(locale, registrationId)
  if (!path) return null
  return `${appOrigin()}${path}`
}
