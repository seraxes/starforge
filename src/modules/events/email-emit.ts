/**
 * product:events → Email Manager emits (emitEmailTrigger only).
 * Organizer notify, attendee reminder (JobRunner), registrant cancelled.
 */

import 'server-only'

import { eq, inArray } from 'drizzle-orm'

import { db, sfUsers } from '@/core/db'
import { getJobRunner, registerJobHandler } from '@/core/jobs'

import { DEFAULT_LOCALE } from '@/core/i18n/locales'

import { buildRegistrationTicketAbsoluteUrl } from './check-in-ticket'
import type { EventRecord } from './types'
import type { EventRegistrationRecord } from './registrations'
import {
  EVENTS_ATTENDEE_REMINDER_JOB,
  EVENTS_ATTENDEE_REMINDER_TRIGGER,
  EVENTS_ORGANIZER_NOTIFY_TRIGGER,
  EVENTS_REGISTERED_TRIGGER,
  EVENTS_REGISTRANT_CANCELLED_TRIGGER,
  EVENTS_REMINDER_HOURS_BEFORE,
} from './triggers'
import { findEventById } from './store'
import { findTicketTierById } from './tiers'
import { sfEventRegistrations } from './schema'

export type EventsRegistrationEmailPayload = {
  eventId: string
  eventTitle: string
  eventSlug: string
  eventStartsAt: string
  registrationId: string
  registrationStatus: string
  ticketTierId: string
  ticketTierTitle: string
  name: string
  email: string
  guests: number
  attendance: string
  submissionId: string
  respondentEmail: string
  organizerEmails: string[]
  /** Signed public ticket URL with door check-in QR (registered seats). */
  ticketUrl: string
}

async function resolveTierTitle(ticketTierId: string | null | undefined): Promise<string> {
  const id = (ticketTierId || '').trim()
  if (!id) return ''
  try {
    const tier = await findTicketTierById(id)
    return tier?.title || ''
  } catch {
    return ''
  }
}

/** Map a raw `sf_event_registrations` row for email payloads (avoids circular import with registrations.ts). */
export function mapRegistrationRowForEmail(row: {
  id: string
  ticketTierId: string | null
  submissionId: string | null
  name: string | null
  email: string | null
  guests: number | null
  attendance: string | null
  status: string
}): Pick<
  EventRegistrationRecord,
  | 'id'
  | 'status'
  | 'ticketTierId'
  | 'name'
  | 'email'
  | 'guests'
  | 'attendance'
  | 'submissionId'
> {
  const status = row.status as EventRegistrationRecord['status']
  return {
    id: row.id,
    ticketTierId: (row.ticketTierId || '').trim(),
    submissionId: (row.submissionId || '').trim(),
    name: row.name?.trim() || '',
    email: (row.email || '').trim().toLowerCase(),
    guests:
      typeof row.guests === 'number' && Number.isFinite(row.guests) && row.guests > 0
        ? Math.floor(row.guests)
        : 1,
    attendance: (row.attendance || 'in_person').trim() || 'in_person',
    status:
      status === 'waitlisted' ||
      status === 'cancelled' ||
      status === 'registered' ||
      status === 'pending_payment'
        ? status
        : 'registered',
  }
}

/** Manager user emails for organizer-notify audience. */
export async function resolveOrganizerEmails(
  event: Pick<EventRecord, 'managerUserIds'>,
): Promise<string[]> {
  const ids = [...new Set((event.managerUserIds || []).map((id) => id.trim()).filter(Boolean))]
  if (!ids.length) return []
  try {
    const rows = await db
      .select({ email: sfUsers.email })
      .from(sfUsers)
      .where(inArray(sfUsers.id, ids))
    const out: string[] = []
    const seen = new Set<string>()
    for (const row of rows) {
      const email = (row.email || '').trim().toLowerCase()
      if (!email || !email.includes('@') || seen.has(email)) continue
      seen.add(email)
      out.push(email)
    }
    return out
  } catch {
    return []
  }
}

export async function buildEventsRegistrationEmailPayload(input: {
  event: Pick<EventRecord, 'id' | 'title' | 'slug' | 'startsAt' | 'managerUserIds'>
  registration: Pick<
    EventRegistrationRecord,
    | 'id'
    | 'status'
    | 'ticketTierId'
    | 'name'
    | 'email'
    | 'guests'
    | 'attendance'
    | 'submissionId'
  >
  ticketTierTitle?: string
  organizerEmails?: string[]
}): Promise<EventsRegistrationEmailPayload> {
  const tierTitle =
    input.ticketTierTitle !== undefined
      ? input.ticketTierTitle
      : await resolveTierTitle(input.registration.ticketTierId)
  const organizerEmails =
    input.organizerEmails !== undefined
      ? input.organizerEmails
      : await resolveOrganizerEmails(input.event)
  const email = (input.registration.email || '').trim().toLowerCase()
  const ticketUrl =
    input.registration.status === 'registered'
      ? buildRegistrationTicketAbsoluteUrl(DEFAULT_LOCALE, input.registration.id) ||
        ''
      : ''
  return {
    eventId: input.event.id,
    eventTitle: input.event.title,
    eventSlug: input.event.slug,
    eventStartsAt: input.event.startsAt ? input.event.startsAt.toISOString() : '',
    registrationId: input.registration.id,
    registrationStatus: input.registration.status,
    ticketTierId: input.registration.ticketTierId || '',
    ticketTierTitle: tierTitle,
    name: input.registration.name,
    email,
    guests: input.registration.guests,
    attendance: input.registration.attendance,
    submissionId: input.registration.submissionId || '',
    respondentEmail: email,
    organizerEmails,
    ticketUrl,
  }
}

async function emitIfEnabled(
  triggerKey: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const { emitEmailTrigger, isEmailManagerEnabled } = await import(
    '@/modules/email-manager/api.server'
  )
  if (!(await isEmailManagerEnabled())) return
  await emitEmailTrigger({ triggerKey, payload })
}

/**
 * After a free / waitlist signup is confirmed: registrant confirm + organizer notify + reminder schedule.
 * Paid seats call {@link emitEventsRegisteredLifecycle} from the payments hook instead.
 */
export async function emitEventsSignupEmails(input: {
  event: Pick<EventRecord, 'id' | 'title' | 'slug' | 'startsAt' | 'managerUserIds'>
  registration: Pick<
    EventRegistrationRecord,
    | 'id'
    | 'status'
    | 'ticketTierId'
    | 'name'
    | 'email'
    | 'guests'
    | 'attendance'
    | 'submissionId'
  >
  ticketTierTitle?: string
}): Promise<void> {
  const status = input.registration.status
  if (status !== 'registered' && status !== 'waitlisted') return

  try {
    const payload = await buildEventsRegistrationEmailPayload(input)
    await emitIfEnabled(EVENTS_REGISTERED_TRIGGER, payload)
    if (payload.organizerEmails.length) {
      await emitIfEnabled(EVENTS_ORGANIZER_NOTIFY_TRIGGER, payload)
    }
    if (status === 'registered') {
      await scheduleAttendeeReminder(payload.registrationId, input.event.startsAt)
    }
  } catch (error) {
    console.error('[events] signup email emit failed', error)
  }
}

/** Paid confirm or waitlist promote → registered lifecycle. */
export async function emitEventsRegisteredLifecycle(input: {
  event: Pick<EventRecord, 'id' | 'title' | 'slug' | 'startsAt' | 'managerUserIds'>
  registration: Pick<
    EventRegistrationRecord,
    | 'id'
    | 'status'
    | 'ticketTierId'
    | 'name'
    | 'email'
    | 'guests'
    | 'attendance'
    | 'submissionId'
  >
  ticketTierTitle?: string
  /** When true (waitlist promote), skip organizer-notify — already fired on join. */
  skipOrganizerNotify?: boolean
}): Promise<void> {
  if (input.registration.status !== 'registered') return
  try {
    const payload = await buildEventsRegistrationEmailPayload(input)
    await emitIfEnabled(EVENTS_REGISTERED_TRIGGER, payload)
    if (!input.skipOrganizerNotify && payload.organizerEmails.length) {
      await emitIfEnabled(EVENTS_ORGANIZER_NOTIFY_TRIGGER, payload)
    }
    await scheduleAttendeeReminder(payload.registrationId, input.event.startsAt)
  } catch (error) {
    console.error('[events] registered lifecycle email failed', error)
  }
}

export async function emitEventsRegistrantCancelled(input: {
  event: Pick<EventRecord, 'id' | 'title' | 'slug' | 'startsAt' | 'managerUserIds'>
  registration: Pick<
    EventRegistrationRecord,
    | 'id'
    | 'status'
    | 'ticketTierId'
    | 'name'
    | 'email'
    | 'guests'
    | 'attendance'
    | 'submissionId'
  >
  ticketTierTitle?: string
}): Promise<void> {
  try {
    const payload = await buildEventsRegistrationEmailPayload({
      ...input,
      registration: { ...input.registration, status: 'cancelled' },
    })
    await emitIfEnabled(EVENTS_REGISTRANT_CANCELLED_TRIGGER, payload)
  } catch (error) {
    console.error('[events] cancelled email emit failed', error)
  }
}

export async function scheduleAttendeeReminder(
  registrationId: string,
  startsAt: Date | null | undefined,
): Promise<void> {
  const id = registrationId.trim()
  if (!id || !startsAt || !Number.isFinite(startsAt.getTime())) return

  const runAt = new Date(
    startsAt.getTime() - EVENTS_REMINDER_HOURS_BEFORE * 60 * 60 * 1000,
  )
  if (runAt.getTime() <= Date.now() - 60_000) {
    // Event already started (or reminder window passed more than a minute ago).
    return
  }

  ensureEventsReminderJob()
  try {
    await getJobRunner().enqueue({
      name: EVENTS_ATTENDEE_REMINDER_JOB,
      payload: { registrationId: id },
      runAt,
      idempotencyKey: `${EVENTS_ATTENDEE_REMINDER_JOB}:${id}`,
    })
  } catch (error) {
    console.error('[events] reminder schedule failed', error)
  }
}

let reminderJobRegistered = false

/** Idempotent — safe from form hooks / payment bridge / admin. */
export function ensureEventsReminderJob(): void {
  if (reminderJobRegistered) return
  reminderJobRegistered = true

  registerJobHandler(EVENTS_ATTENDEE_REMINDER_JOB, async (payload) => {
    const registrationId = String(payload.registrationId || '').trim()
    if (!registrationId) return

    const [row] = await db
      .select()
      .from(sfEventRegistrations)
      .where(eq(sfEventRegistrations.id, registrationId))
      .limit(1)
    if (!row || row.status !== 'registered') return

    const event = await findEventById(row.eventId)
    if (!event || event.status === 'cancelled') return

    const tierTitle = await resolveTierTitle(row.ticketTierId)
    const emailPayload = await buildEventsRegistrationEmailPayload({
      event,
      registration: mapRegistrationRowForEmail(row),
      ticketTierTitle: tierTitle,
    })

    await emitIfEnabled(EVENTS_ATTENDEE_REMINDER_TRIGGER, emailPayload)
  })
}
