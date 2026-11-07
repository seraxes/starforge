/**
 * Event registration persistence + capacity (product:events PR3 + densify).
 */

import 'server-only'

import { and, asc, desc, eq, inArray, ne, sql } from 'drizzle-orm'

import { db } from '@/core/db'

import { sfEventRegistrations } from './schema'
import { loadEventsModuleSettings } from './settings'
import { findEventById } from './store'
import type { EventRecord } from './types'
import {
  countRegisteredGuestsForTier,
  findTicketTierById,
} from './tiers'

/** True when public signup is allowed for a published event. */
export function isEventRegistrationOpen(
  event: Pick<
    EventRecord,
    'status' | 'registrationOpensAt' | 'registrationClosesAt'
  >,
  now = new Date(),
): { open: boolean; reason?: string } {
  if (event.status !== 'published') {
    return { open: false, reason: 'Event is not open for registration.' }
  }
  if (event.registrationOpensAt && now < event.registrationOpensAt) {
    return { open: false, reason: 'Registration is not open yet.' }
  }
  if (event.registrationClosesAt && now > event.registrationClosesAt) {
    return { open: false, reason: 'Registration has closed.' }
  }
  return { open: true }
}

export type RegistrationStatus = 'registered' | 'waitlisted' | 'cancelled'

export type EventRegistrationRecord = {
  id: string
  eventId: string
  ticketTierId: string
  submissionId: string
  userId: string
  name: string
  email: string
  guests: number
  attendance: string
  notes: string
  status: RegistrationStatus
  createdAt: Date
  updatedAt: Date
}

function mapRow(row: typeof sfEventRegistrations.$inferSelect): EventRegistrationRecord {
  const status = row.status as RegistrationStatus
  return {
    id: row.id,
    eventId: row.eventId,
    ticketTierId: (row.ticketTierId || '').trim(),
    submissionId: (row.submissionId || '').trim(),
    userId: (row.userId || '').trim(),
    name: row.name?.trim() || '',
    email: (row.email || '').trim().toLowerCase(),
    guests:
      typeof row.guests === 'number' && Number.isFinite(row.guests) && row.guests > 0
        ? Math.floor(row.guests)
        : 1,
    attendance: (row.attendance || 'in_person').trim() || 'in_person',
    notes: row.notes ?? '',
    status:
      status === 'waitlisted' || status === 'cancelled' || status === 'registered'
        ? status
        : 'registered',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

/** Count guest seats that occupy event capacity (registered only). */
export async function countRegisteredGuests(eventId: string): Promise<number> {
  const trimmed = eventId.trim()
  if (!trimmed) return 0
  try {
    const [row] = await db
      .select({
        n: sql<number>`coalesce(sum(${sfEventRegistrations.guests}), 0)`,
      })
      .from(sfEventRegistrations)
      .where(
        and(
          eq(sfEventRegistrations.eventId, trimmed),
          eq(sfEventRegistrations.status, 'registered'),
        ),
      )
    return Number(row?.n) || 0
  } catch {
    return 0
  }
}

export type EventRegistrationListStats = {
  registered: number
  waitlisted: number
}

/** Batch guest totals for the admin events table (registered + waitlisted). */
export async function countRegistrationStatsForEvents(
  eventIds: string[],
): Promise<Map<string, EventRegistrationListStats>> {
  const map = new Map<string, EventRegistrationListStats>()
  const ids = [...new Set(eventIds.map((id) => id.trim()).filter(Boolean))]
  for (const id of ids) {
    map.set(id, { registered: 0, waitlisted: 0 })
  }
  if (ids.length === 0) return map

  try {
    const rows = await db
      .select({
        eventId: sfEventRegistrations.eventId,
        status: sfEventRegistrations.status,
        n: sql<number>`coalesce(sum(${sfEventRegistrations.guests}), 0)`,
      })
      .from(sfEventRegistrations)
      .where(
        and(
          inArray(sfEventRegistrations.eventId, ids),
          inArray(sfEventRegistrations.status, ['registered', 'waitlisted']),
        ),
      )
      .groupBy(sfEventRegistrations.eventId, sfEventRegistrations.status)

    for (const row of rows) {
      const cur = map.get(row.eventId) ?? { registered: 0, waitlisted: 0 }
      const n = Number(row.n) || 0
      if (row.status === 'waitlisted') cur.waitlisted = n
      else if (row.status === 'registered') cur.registered = n
      map.set(row.eventId, cur)
    }
  } catch {
    /* empty stats */
  }
  return map
}

export type CreateRegistrationInput = {
  eventId: string
  ticketTierId?: string | null
  submissionId?: string
  userId?: string | null
  name: string
  email: string
  guests?: number
  attendance?: string
  notes?: string
  /** Admin UI: skip public registration-window gate; status may be set explicitly. */
  admin?: boolean
  status?: RegistrationStatus
}

/**
 * Insert a registration. Auto waitlists when event or tier capacity exceeded.
 */
export async function createEventRegistration(
  input: CreateRegistrationInput,
): Promise<
  | { registration: EventRegistrationRecord }
  | { error: string }
> {
  const eventId = input.eventId.trim()
  if (!eventId) return { error: 'Missing event id.' }

  const event = await findEventById(eventId)
  if (!event) return { error: 'Event not found.' }
  if (!input.admin) {
    const window = isEventRegistrationOpen(event)
    if (!window.open) {
      return { error: window.reason || 'Event is not open for registration.' }
    }
  }

  const guestsRaw = input.guests ?? 1
  const guests =
    typeof guestsRaw === 'number' && Number.isFinite(guestsRaw) && guestsRaw > 0
      ? Math.min(Math.floor(guestsRaw), 20)
      : 1

  let ticketTierId = (input.ticketTierId || '').trim() || null
  let tierCapacity: number | null = null
  if (ticketTierId) {
    const tier = await findTicketTierById(ticketTierId)
    if (!tier || tier.eventId !== eventId) {
      return { error: 'Selected ticket tier was not found for this event.' }
    }
    tierCapacity = tier.capacity
  }

  let status: RegistrationStatus = 'registered'
  if (
    input.admin &&
    (input.status === 'registered' ||
      input.status === 'waitlisted' ||
      input.status === 'cancelled')
  ) {
    status = input.status
  } else {
    const occupiedEvent = await countRegisteredGuests(eventId)
    if (typeof event.capacity === 'number' && event.capacity >= 0) {
      if (occupiedEvent >= event.capacity || occupiedEvent + guests > event.capacity) {
        status = 'waitlisted'
      }
    }
    if (status === 'registered' && ticketTierId && typeof tierCapacity === 'number') {
      const occupiedTier = await countRegisteredGuestsForTier(eventId, ticketTierId)
      if (occupiedTier >= tierCapacity || occupiedTier + guests > tierCapacity) {
        status = 'waitlisted'
      }
    }
  }

  const id = crypto.randomUUID()
  const name = input.name.trim().slice(0, 200) || 'Guest'
  const email = input.email.trim().toLowerCase().slice(0, 320)
  if (!email || !email.includes('@')) {
    return { error: 'A valid email is required.' }
  }

  const { settings } = await loadEventsModuleSettings()
  if (settings.preventDuplicate) {
    try {
      const [dup] = await db
        .select({ id: sfEventRegistrations.id })
        .from(sfEventRegistrations)
        .where(
          and(
            eq(sfEventRegistrations.eventId, eventId),
            eq(sfEventRegistrations.email, email),
            ne(sfEventRegistrations.status, 'cancelled'),
          ),
        )
        .limit(1)
      if (dup) {
        return { error: 'You are already registered for this event.' }
      }
    } catch {
      // Table missing → insert path reports migrate hint.
    }
  }

  try {
    await db.insert(sfEventRegistrations).values({
      id,
      eventId,
      ticketTierId,
      submissionId: (input.submissionId || '').trim() || null,
      userId: (input.userId || '').trim() || null,
      name,
      email,
      guests,
      attendance: (input.attendance || 'in_person').trim().slice(0, 40) || 'in_person',
      notes: (input.notes || '').trim().slice(0, 2000),
      status,
    })
    const [row] = await db
      .select()
      .from(sfEventRegistrations)
      .where(eq(sfEventRegistrations.id, id))
      .limit(1)
    if (!row) return { error: 'Registration saved but could not be reloaded.' }
    return { registration: mapRow(row) }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_event_registrations|does not exist|relation/i.test(msg)) {
      return {
        error:
          'sf_event_registrations missing — run npm run db:migrate (or db:core:push).',
      }
    }
    return {
      error: error instanceof Error ? error.message : 'Could not save registration.',
    }
  }
}

export async function listRegistrationsForEvent(
  eventId: string,
  options?: { includeCancelled?: boolean },
): Promise<EventRegistrationRecord[]> {
  const trimmed = eventId.trim()
  if (!trimmed) return []
  try {
    const rows = options?.includeCancelled
      ? await db
          .select()
          .from(sfEventRegistrations)
          .where(eq(sfEventRegistrations.eventId, trimmed))
          .orderBy(desc(sfEventRegistrations.createdAt))
      : await db
          .select()
          .from(sfEventRegistrations)
          .where(
            and(
              eq(sfEventRegistrations.eventId, trimmed),
              ne(sfEventRegistrations.status, 'cancelled'),
            ),
          )
          .orderBy(asc(sfEventRegistrations.status), desc(sfEventRegistrations.createdAt))
    return rows.map(mapRow)
  } catch {
    return []
  }
}

export async function updateRegistrationStatus(
  id: string,
  status: RegistrationStatus,
): Promise<{ registration: EventRegistrationRecord } | { error: string }> {
  const trimmed = id.trim()
  if (!trimmed) return { error: 'Missing registration id.' }
  if (
    status !== 'registered' &&
    status !== 'waitlisted' &&
    status !== 'cancelled'
  ) {
    return { error: 'Invalid status.' }
  }
  try {
    await db
      .update(sfEventRegistrations)
      .set({ status })
      .where(eq(sfEventRegistrations.id, trimmed))
    const [row] = await db
      .select()
      .from(sfEventRegistrations)
      .where(eq(sfEventRegistrations.id, trimmed))
      .limit(1)
    if (!row) return { error: 'Registration not found.' }
    return { registration: mapRow(row) }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Could not update status.',
    }
  }
}

export type AdminUpdateRegistrationInput = {
  id: string
  name: string
  email: string
  guests?: number
  attendance?: string
  notes?: string
  ticketTierId?: string | null
  userId?: string | null
  status: RegistrationStatus
}

/** Admin: update registrant fields (not just status). */
export async function updateEventRegistration(
  input: AdminUpdateRegistrationInput,
): Promise<{ registration: EventRegistrationRecord } | { error: string }> {
  const id = input.id.trim()
  if (!id) return { error: 'Missing registration id.' }

  const email = input.email.trim().toLowerCase().slice(0, 320)
  if (!email || !email.includes('@')) {
    return { error: 'A valid email is required.' }
  }
  if (
    input.status !== 'registered' &&
    input.status !== 'waitlisted' &&
    input.status !== 'cancelled'
  ) {
    return { error: 'Invalid status.' }
  }

  const guestsRaw = input.guests ?? 1
  const guests =
    typeof guestsRaw === 'number' && Number.isFinite(guestsRaw) && guestsRaw > 0
      ? Math.min(Math.floor(guestsRaw), 20)
      : 1

  try {
    const [current] = await db
      .select()
      .from(sfEventRegistrations)
      .where(eq(sfEventRegistrations.id, id))
      .limit(1)
    if (!current) return { error: 'Registration not found.' }

    let ticketTierId = (input.ticketTierId || '').trim() || null
    if (ticketTierId) {
      const tier = await findTicketTierById(ticketTierId)
      if (!tier || tier.eventId !== current.eventId) {
        return { error: 'Selected ticket tier was not found for this event.' }
      }
    }

    const userId =
      input.userId !== undefined
        ? (input.userId || '').trim() || null
        : current.userId

    await db
      .update(sfEventRegistrations)
      .set({
        name: input.name.trim().slice(0, 200) || 'Guest',
        email,
        guests,
        attendance: (input.attendance || 'in_person').trim().slice(0, 40) || 'in_person',
        notes: (input.notes || '').trim().slice(0, 2000),
        ticketTierId,
        userId,
        status: input.status,
      })
      .where(eq(sfEventRegistrations.id, id))

    const [row] = await db
      .select()
      .from(sfEventRegistrations)
      .where(eq(sfEventRegistrations.id, id))
      .limit(1)
    if (!row) return { error: 'Registration updated but could not be reloaded.' }
    return { registration: mapRow(row) }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Could not update registration.',
    }
  }
}

export async function deleteEventRegistration(
  id: string,
): Promise<{ ok: true } | { error: string }> {
  const trimmed = id.trim()
  if (!trimmed) return { error: 'Missing registration id.' }
  try {
    await db.delete(sfEventRegistrations).where(eq(sfEventRegistrations.id, trimmed))
    return { ok: true }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Could not delete registration.',
    }
  }
}
