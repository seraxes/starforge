/**
 * Event registration persistence + capacity (product:events PR3 + densify).
 */

import 'server-only'

import { and, asc, desc, eq, inArray, ne, sql } from 'drizzle-orm'

import { db } from '@/core/db'

import {
  ACTIVE_SIGNUP_STATUSES,
  isAdminRegistrationStatus,
  normalizeRegistrationStatus,
  registrationHoldsSeat,
  registrationSeatFreed,
  resolveInitialRegistrationStatus,
  SEAT_HOLDING_STATUSES,
  type RegistrationStatus,
} from './registration-status'
import { sfEventRegistrations } from './schema'
import { loadEventsModuleSettings } from './settings'
import { findEventById } from './store'
import type { EventRecord } from './types'
import {
  countRegisteredGuestsForTier,
  effectiveMaxTicketsPerBooking,
  findTicketTierById,
} from './tiers'
import { DEFAULT_MAX_TICKETS_PER_BOOKING } from './types'
import { EVENTS_WAITLIST_PROMOTED_TRIGGER } from './triggers'

export type { RegistrationStatus }
export { EVENTS_WAITLIST_PROMOTED_TRIGGER }

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

/**
 * True when the signed-in attendee may cancel or Switch-to.
 * Empty `cancellationClosesAt` = self-service disabled.
 */
export function isEventSelfCancelOpen(
  event: Pick<EventRecord, 'status' | 'cancellationClosesAt'>,
  now = new Date(),
): { open: boolean; reason?: string } {
  if (event.status !== 'published') {
    return { open: false, reason: 'Event is not open for self-service changes.' }
  }
  if (!event.cancellationClosesAt) {
    return {
      open: false,
      reason: 'Self-service cancel is not enabled for this event.',
    }
  }
  if (now > event.cancellationClosesAt) {
    return { open: false, reason: 'The cancellation deadline has passed.' }
  }
  return { open: true }
}

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
  paymentOrderId: string
  /** Manual door check-in time; null when not checked in. */
  checkedInAt: Date | null
  createdAt: Date
  updatedAt: Date
}

function mapRow(row: typeof sfEventRegistrations.$inferSelect): EventRegistrationRecord {
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
    status: normalizeRegistrationStatus(row.status),
    paymentOrderId: (row.paymentOrderId || '').trim(),
    checkedInAt: row.checkedInAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

/** Count guest seats that occupy event capacity (registered, pending approval, pending payment). */
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
          inArray(sfEventRegistrations.status, [...SEAT_HOLDING_STATUSES]),
        ),
      )
    return Number(row?.n) || 0
  } catch {
    return 0
  }
}

export type EventRegistrationListStats = {
  registered: number
  pending: number
  waitlisted: number
}

/** Batch guest totals for the admin events table (registered, pending approval, waitlisted). */
export async function countRegistrationStatsForEvents(
  eventIds: string[],
): Promise<Map<string, EventRegistrationListStats>> {
  const map = new Map<string, EventRegistrationListStats>()
  const ids = [...new Set(eventIds.map((id) => id.trim()).filter(Boolean))]
  for (const id of ids) {
    map.set(id, { registered: 0, pending: 0, waitlisted: 0 })
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
          inArray(sfEventRegistrations.status, ['registered', 'pending', 'waitlisted']),
        ),
      )
      .groupBy(sfEventRegistrations.eventId, sfEventRegistrations.status)

    for (const row of rows) {
      const cur = map.get(row.eventId) ?? { registered: 0, pending: 0, waitlisted: 0 }
      const n = Number(row.n) || 0
      if (row.status === 'waitlisted') cur.waitlisted = n
      else if (row.status === 'pending') cur.pending = n
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
  paymentOrderId?: string | null
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

  let ticketTierId = (input.ticketTierId || '').trim() || null
  let tierCapacity: number | null = null
  let bookingCap = DEFAULT_MAX_TICKETS_PER_BOOKING
  if (ticketTierId) {
    const tier = await findTicketTierById(ticketTierId)
    if (!tier || tier.eventId !== eventId) {
      return { error: 'Selected ticket tier was not found for this event.' }
    }
    tierCapacity = tier.capacity
    bookingCap = effectiveMaxTicketsPerBooking(tier.maxPerBooking)
  }

  const guestsRaw = input.guests ?? 1
  const guests =
    typeof guestsRaw === 'number' && Number.isFinite(guestsRaw) && guestsRaw > 0
      ? Math.min(Math.floor(guestsRaw), bookingCap)
      : 1

  let status: RegistrationStatus = 'registered'
  if (
    input.status === 'pending_payment' ||
    (input.admin && isAdminRegistrationStatus(input.status))
  ) {
    status = input.status
  } else {
    let needsWaitlist = false
    const occupiedEvent = await countRegisteredGuests(eventId)
    if (typeof event.capacity === 'number' && event.capacity >= 0) {
      if (occupiedEvent >= event.capacity || occupiedEvent + guests > event.capacity) {
        needsWaitlist = true
      }
    }
    if (!needsWaitlist && ticketTierId && typeof tierCapacity === 'number') {
      const occupiedTier = await countRegisteredGuestsForTier(eventId, ticketTierId)
      if (occupiedTier >= tierCapacity || occupiedTier + guests > tierCapacity) {
        needsWaitlist = true
      }
    }
    if (needsWaitlist && !event.waitlistEnabled) {
      return { error: 'This event is full and the waitlist is closed.' }
    }
    status = resolveInitialRegistrationStatus({
      needsWaitlist,
      requireApproval: !input.admin && event.requireApproval,
    })
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
      paymentOrderId: (input.paymentOrderId || '').trim() || null,
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

/** Active signups for a logged-in user — hub status and the account list. */
export async function listActiveRegistrationsForUser(
  userId: string,
): Promise<EventRegistrationRecord[]> {
  const trimmed = userId.trim()
  if (!trimmed) return []
  try {
    const rows = await db
      .select()
      .from(sfEventRegistrations)
      .where(
        and(
          eq(sfEventRegistrations.userId, trimmed),
          inArray(sfEventRegistrations.status, [...ACTIVE_SIGNUP_STATUSES]),
        ),
      )
      .orderBy(desc(sfEventRegistrations.createdAt))
    return rows.map(mapRow)
  } catch {
    return []
  }
}

/** Single registration by id. */
export async function findRegistrationById(
  id: string,
): Promise<EventRegistrationRecord | null> {
  const trimmed = id.trim()
  if (!trimmed) return null
  try {
    const [row] = await db
      .select()
      .from(sfEventRegistrations)
      .where(eq(sfEventRegistrations.id, trimmed))
      .limit(1)
    return row ? mapRow(row) : null
  } catch {
    return null
  }
}

/** Latest active signup for one user on one event (if any). */
export async function findActiveRegistrationForUserOnEvent(
  userId: string,
  eventId: string,
): Promise<EventRegistrationRecord | null> {
  const uid = userId.trim()
  const eid = eventId.trim()
  if (!uid || !eid) return null
  try {
    const [row] = await db
      .select()
      .from(sfEventRegistrations)
      .where(
        and(
          eq(sfEventRegistrations.userId, uid),
          eq(sfEventRegistrations.eventId, eid),
          inArray(sfEventRegistrations.status, [...ACTIVE_SIGNUP_STATUSES]),
        ),
      )
      .orderBy(desc(sfEventRegistrations.createdAt))
      .limit(1)
    return row ? mapRow(row) : null
  } catch {
    return null
  }
}

/** Attendee confirmation when an admin sets a pending signup to registered. */
async function notifyRegistrationApproved(
  registration: EventRegistrationRecord,
): Promise<void> {
  try {
    const event = await findEventById(registration.eventId)
    if (!event) return
    const { emitEventsRegisteredLifecycle } = await import('./email-emit')
    await emitEventsRegisteredLifecycle({
      event,
      registration,
      skipOrganizerNotify: true,
    })
  } catch {
    /* email optional */
  }
}

export async function updateRegistrationStatus(
  id: string,
  status: RegistrationStatus,
): Promise<{ registration: EventRegistrationRecord } | { error: string }> {
  const trimmed = id.trim()
  if (!trimmed) return { error: 'Missing registration id.' }
  if (!isAdminRegistrationStatus(status)) {
    return { error: 'Invalid status.' }
  }
  try {
    const [current] = await db
      .select()
      .from(sfEventRegistrations)
      .where(eq(sfEventRegistrations.id, trimmed))
      .limit(1)
    if (!current) return { error: 'Registration not found.' }

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
    const registration = mapRow(row)
    if (current.status !== 'cancelled' && status === 'cancelled') {
      const event = await findEventById(current.eventId)
      if (event) {
        const { emitEventsRegistrantCancelled } = await import('./email-emit')
        await emitEventsRegistrantCancelled({ event, registration })
      }
    }
    if (current.status === 'pending' && status === 'registered') {
      await notifyRegistrationApproved(registration)
    }
    if (
      registrationSeatFreed({
        previousStatus: current.status,
        nextStatus: status,
        previousGuests: Number(current.guests) || 1,
        nextGuests: Number(current.guests) || 1,
      })
    ) {
      await promoteWaitlistForEvent(current.eventId)
    }
    return { registration }
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
  if (!isAdminRegistrationStatus(input.status)) {
    return { error: 'Invalid status.' }
  }

  try {
    const [current] = await db
      .select()
      .from(sfEventRegistrations)
      .where(eq(sfEventRegistrations.id, id))
      .limit(1)
    if (!current) return { error: 'Registration not found.' }

    let ticketTierId = (input.ticketTierId || '').trim() || null
    let bookingCap = DEFAULT_MAX_TICKETS_PER_BOOKING
    if (ticketTierId) {
      const tier = await findTicketTierById(ticketTierId)
      if (!tier || tier.eventId !== current.eventId) {
        return { error: 'Selected ticket tier was not found for this event.' }
      }
      bookingCap = effectiveMaxTicketsPerBooking(tier.maxPerBooking)
    }

    const guestsRaw = input.guests ?? 1
    const guests =
      typeof guestsRaw === 'number' && Number.isFinite(guestsRaw) && guestsRaw > 0
        ? Math.min(Math.floor(guestsRaw), bookingCap)
        : 1

    const userId =
      input.userId !== undefined
        ? (input.userId || '').trim() || null
        : current.userId

    const previousGuests = Number(current.guests) || 1
    const freedSeat = registrationSeatFreed({
      previousStatus: current.status,
      nextStatus: input.status,
      previousGuests,
      nextGuests: guests,
    })

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
    const registration = mapRow(row)
    if (current.status !== 'cancelled' && input.status === 'cancelled') {
      const event = await findEventById(current.eventId)
      if (event) {
        const { emitEventsRegistrantCancelled } = await import('./email-emit')
        await emitEventsRegistrantCancelled({ event, registration })
      }
    }
    if (current.status === 'pending' && input.status === 'registered') {
      await notifyRegistrationApproved(registration)
    }
    if (freedSeat) {
      await promoteWaitlistForEvent(current.eventId)
    }
    return { registration }
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
    const [current] = await db
      .select({ eventId: sfEventRegistrations.eventId, status: sfEventRegistrations.status })
      .from(sfEventRegistrations)
      .where(eq(sfEventRegistrations.id, trimmed))
      .limit(1)
    await db.delete(sfEventRegistrations).where(eq(sfEventRegistrations.id, trimmed))
    if (current && registrationHoldsSeat(current.status)) {
      await promoteWaitlistForEvent(current.eventId)
    }
    return { ok: true }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Could not delete registration.',
    }
  }
}

/**
 * Manual door check-in: set checkedInAt now.
 * Only `registered` rows may check in (not waitlist / pending / cancelled).
 */
export async function checkInRegistration(
  id: string,
): Promise<{ registration: EventRegistrationRecord } | { error: string }> {
  const trimmed = id.trim()
  if (!trimmed) return { error: 'Missing registration id.' }
  try {
    const [current] = await db
      .select()
      .from(sfEventRegistrations)
      .where(eq(sfEventRegistrations.id, trimmed))
      .limit(1)
    if (!current) return { error: 'Registration not found.' }
    if (current.status !== 'registered') {
      return {
        error: `Cannot check in a ${current.status} registration — only registered guests.`,
      }
    }
    if (current.checkedInAt) {
      return { registration: mapRow(current) }
    }
    const now = new Date()
    await db
      .update(sfEventRegistrations)
      .set({ checkedInAt: now })
      .where(eq(sfEventRegistrations.id, trimmed))
    const [row] = await db
      .select()
      .from(sfEventRegistrations)
      .where(eq(sfEventRegistrations.id, trimmed))
      .limit(1)
    if (!row) return { error: 'Check-in saved but could not be reloaded.' }
    return { registration: mapRow(row) }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Could not check in.',
    }
  }
}

/** Clear manual door check-in (staff undo). */
export async function clearRegistrationCheckIn(
  id: string,
): Promise<{ registration: EventRegistrationRecord } | { error: string }> {
  const trimmed = id.trim()
  if (!trimmed) return { error: 'Missing registration id.' }
  try {
    const [current] = await db
      .select()
      .from(sfEventRegistrations)
      .where(eq(sfEventRegistrations.id, trimmed))
      .limit(1)
    if (!current) return { error: 'Registration not found.' }
    await db
      .update(sfEventRegistrations)
      .set({ checkedInAt: null })
      .where(eq(sfEventRegistrations.id, trimmed))
    const [row] = await db
      .select()
      .from(sfEventRegistrations)
      .where(eq(sfEventRegistrations.id, trimmed))
      .limit(1)
    if (!row) return { error: 'Check-in cleared but could not be reloaded.' }
    return { registration: mapRow(row) }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Could not clear check-in.',
    }
  }
}

export type CancelOwnRegistrationResult =
  | {
      registration: EventRegistrationRecord
      refund?: { ok: boolean; message?: string; code?: string }
    }
  | { error: string }

/**
 * Signed-in attendee cancels their own signup before the event cancel deadline.
 * Always frees the seat + promotes waitlist. Optional refund request is opt-in
 * (event.selfCancelRefund + requestRefund) and never blocks cancel when Payments
 * refunds are still stubbed.
 */
export async function cancelOwnRegistration(
  userId: string,
  registrationId: string,
  options?: { requestRefund?: boolean },
): Promise<CancelOwnRegistrationResult> {
  const uid = userId.trim()
  const rid = registrationId.trim()
  if (!uid || !rid) return { error: 'Missing registration.' }

  try {
    const [current] = await db
      .select()
      .from(sfEventRegistrations)
      .where(eq(sfEventRegistrations.id, rid))
      .limit(1)
    if (!current) return { error: 'Registration not found.' }
    if ((current.userId || '').trim() !== uid) {
      return { error: 'You can only cancel your own registration.' }
    }
    if (!(ACTIVE_SIGNUP_STATUSES as readonly string[]).includes(current.status)) {
      return { error: 'This registration is already cancelled.' }
    }

    const event = await findEventById(current.eventId)
    if (!event) return { error: 'Event not found.' }
    const window = isEventSelfCancelOpen(event)
    if (!window.open) {
      return { error: window.reason || 'Self-service cancel is closed.' }
    }

    const updated = await updateRegistrationStatus(rid, 'cancelled')
    if ('error' in updated) return updated

    let refund: { ok: boolean; message?: string; code?: string } | undefined
    const wantRefund = options?.requestRefund === true
    const paymentOrderId = (current.paymentOrderId || '').trim()
    if (wantRefund) {
      if (!event.selfCancelRefund) {
        refund = {
          ok: false,
          message: 'Refunds are not enabled for this event.',
          code: 'refunds_not_enabled',
        }
      } else if (!paymentOrderId) {
        refund = {
          ok: false,
          message: 'No paid order is linked to this registration.',
          code: 'no_payment_order',
        }
      } else {
        try {
          const { requestOrderRefund } = await import('@/modules/payments/api')
          const result = await requestOrderRefund({
            orderId: paymentOrderId,
            reason: 'attendee_self_cancel',
            requestedByUserId: uid,
          })
          if (result.ok) {
            refund = { ok: true, message: 'Refund requested.' }
          } else {
            refund = {
              ok: false,
              message: result.error,
              code: result.code,
            }
          }
        } catch {
          refund = {
            ok: false,
            message: 'Refunds are not available right now.',
            code: 'payments_unavailable',
          }
        }
      }
    }

    return { registration: updated.registration, ...(refund ? { refund } : {}) }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Could not cancel registration.',
    }
  }
}

/**
 * Switch an unpaid signup to another ticket type with open slots.
 * Paid seats must cancel first (no silent money moves).
 */
export async function switchOwnRegistrationTier(
  userId: string,
  registrationId: string,
  targetTierId: string,
): Promise<{ registration: EventRegistrationRecord } | { error: string }> {
  const uid = userId.trim()
  const rid = registrationId.trim()
  const tierId = targetTierId.trim()
  if (!uid || !rid || !tierId) return { error: 'Missing registration or ticket type.' }

  try {
    const [current] = await db
      .select()
      .from(sfEventRegistrations)
      .where(eq(sfEventRegistrations.id, rid))
      .limit(1)
    if (!current) return { error: 'Registration not found.' }
    if ((current.userId || '').trim() !== uid) {
      return { error: 'You can only change your own registration.' }
    }
    if (
      current.status !== 'registered' &&
      current.status !== 'pending' &&
      current.status !== 'waitlisted'
    ) {
      return { error: 'Only active registrations can switch ticket types.' }
    }

    const paymentOrderId = (current.paymentOrderId || '').trim()
    if (paymentOrderId) {
      return {
        error: 'Cancel your paid seat first before switching ticket types.',
      }
    }

    const event = await findEventById(current.eventId)
    if (!event) return { error: 'Event not found.' }
    const window = isEventSelfCancelOpen(event)
    if (!window.open) {
      return { error: window.reason || 'Self-service changes are closed.' }
    }

    if ((current.ticketTierId || '').trim() === tierId) {
      return { error: 'You are already on this ticket type.' }
    }

    const tier = await findTicketTierById(tierId)
    if (!tier || tier.eventId !== current.eventId) {
      return { error: 'Ticket type was not found for this event.' }
    }

    const guests = Math.max(1, Number(current.guests) || 1)
    if (typeof tier.capacity === 'number') {
      const occupied = await countRegisteredGuestsForTier(current.eventId, tierId)
      if (occupied + guests > tier.capacity) {
        return { error: 'That ticket type has no open slots.' }
      }
    }
    if (typeof event.capacity === 'number' && event.capacity >= 0) {
      const occupiedEvent = await countRegisteredGuests(current.eventId)
      // Waitlisted rows do not occupy seats yet — switching into a seat counts.
      // Pending approval already holds the seat.
      const alreadyOccupying = registrationHoldsSeat(current.status)
      const nextOccupied = alreadyOccupying ? occupiedEvent : occupiedEvent + guests
      if (nextOccupied > event.capacity) {
        return { error: 'The event has no open slots for that switch.' }
      }
    }

    const nextStatus: RegistrationStatus =
      current.status === 'waitlisted'
        ? 'registered'
        : current.status === 'pending'
          ? 'pending'
          : 'registered'

    await db
      .update(sfEventRegistrations)
      .set({
        ticketTierId: tierId,
        status: nextStatus,
      })
      .where(eq(sfEventRegistrations.id, rid))

    const [row] = await db
      .select()
      .from(sfEventRegistrations)
      .where(eq(sfEventRegistrations.id, rid))
      .limit(1)
    if (!row) return { error: 'Switched but could not reload registration.' }
    return { registration: mapRow(row) }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Could not switch ticket type.',
    }
  }
}

/**
 * FIFO: promote waitlisted rows into registered seats when capacity frees.
 * Skips entries that still cannot fit; stops after a safe iteration budget.
 */
export async function promoteWaitlistForEvent(
  eventId: string,
): Promise<{ promoted: number }> {
  const trimmed = eventId.trim()
  if (!trimmed) return { promoted: 0 }
  const event = await findEventById(trimmed)
  if (!event || !event.waitlistEnabled) return { promoted: 0 }

  let promoted = 0
  for (let i = 0; i < 40; i++) {
    const waiting = await db
      .select()
      .from(sfEventRegistrations)
      .where(
        and(
          eq(sfEventRegistrations.eventId, trimmed),
          eq(sfEventRegistrations.status, 'waitlisted'),
        ),
      )
      .orderBy(asc(sfEventRegistrations.createdAt))
      .limit(1)
    const row = waiting[0]
    if (!row) break

    const guests = Math.max(1, Number(row.guests) || 1)
    const occupiedEvent = await countRegisteredGuests(trimmed)
    if (
      typeof event.capacity === 'number' &&
      event.capacity >= 0 &&
      occupiedEvent + guests > event.capacity
    ) {
      break
    }

    const tierId = (row.ticketTierId || '').trim()
    if (tierId) {
      const tier = await findTicketTierById(tierId)
      if (tier && typeof tier.capacity === 'number') {
        const occupiedTier = await countRegisteredGuestsForTier(trimmed, tierId)
        if (occupiedTier + guests > tier.capacity) {
          // This head-of-line entry cannot fit — stop to preserve FIFO fairness.
          break
        }
      }
    }

    await db
      .update(sfEventRegistrations)
      .set({ status: 'registered' })
      .where(eq(sfEventRegistrations.id, row.id))
    promoted += 1

    try {
      const { emitEmailTrigger, isEmailManagerEnabled } = await import(
        '@/modules/email-manager/api.server'
      )
      if (await isEmailManagerEnabled()) {
        let tierTitle = ''
        if (tierId) {
          const tier = await findTicketTierById(tierId)
          tierTitle = tier?.title || ''
        }
        await emitEmailTrigger({
          triggerKey: EVENTS_WAITLIST_PROMOTED_TRIGGER,
          payload: {
            eventId: event.id,
            eventTitle: event.title,
            eventSlug: event.slug,
            registrationId: row.id,
            registrationStatus: 'registered',
            ticketTierId: tierId,
            ticketTierTitle: tierTitle,
            name: row.name,
            email: row.email,
            guests,
            attendance: row.attendance,
            respondentEmail: row.email,
          },
        })
      }
      const { scheduleAttendeeReminder } = await import('./email-emit')
      await scheduleAttendeeReminder(row.id, event.startsAt)
    } catch {
      /* email optional */
    }
  }

  return { promoted }
}
