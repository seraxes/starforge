/**
 * Registration status rules (product:events).
 * Client-safe — no database imports.
 */

export const REGISTRATION_STATUSES = [
  'registered',
  'pending',
  'waitlisted',
  'pending_payment',
  'cancelled',
] as const

export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number]

/** Rows that occupy event and tier capacity. Waitlist and cancelled do not. */
export const SEAT_HOLDING_STATUSES = [
  'registered',
  'pending',
  'pending_payment',
] as const

/** Signups a member still has (hub, account, duplicate guard). */
export const ACTIVE_SIGNUP_STATUSES = [
  'registered',
  'pending',
  'waitlisted',
  'pending_payment',
] as const

export function isRegistrationStatus(value: unknown): value is RegistrationStatus {
  return (
    typeof value === 'string' &&
    (REGISTRATION_STATUSES as readonly string[]).includes(value)
  )
}

/** Statuses an admin may set. `pending_payment` stays a checkout hold. */
export function isAdminRegistrationStatus(
  value: unknown,
): value is Exclude<RegistrationStatus, 'pending_payment'> {
  return (
    value === 'registered' ||
    value === 'pending' ||
    value === 'waitlisted' ||
    value === 'cancelled'
  )
}

export function normalizeRegistrationStatus(value: unknown): RegistrationStatus {
  return isRegistrationStatus(value) ? value : 'registered'
}

export function registrationHoldsSeat(status: string): boolean {
  return (SEAT_HOLDING_STATUSES as readonly string[]).includes(status)
}

/**
 * Public signup status before any payment handoff.
 * A full event still waitlists. Approval applies only to a seat that would
 * otherwise be registered immediately. Callers pass requireApproval false
 * for admin-chosen statuses.
 */
export function resolveInitialRegistrationStatus(input: {
  needsWaitlist: boolean
  requireApproval: boolean
}): 'waitlisted' | 'pending' | 'registered' {
  if (input.needsWaitlist) return 'waitlisted'
  if (input.requireApproval) return 'pending'
  return 'registered'
}

/** Status after a `pending_payment` hold is paid. */
export function resolveStatusAfterPayment(
  requireApproval: boolean,
): 'pending' | 'registered' {
  return requireApproval ? 'pending' : 'registered'
}

/** True when a status change frees at least one held seat (waitlist may promote). */
export function registrationSeatFreed(input: {
  previousStatus: string
  nextStatus: string
  previousGuests: number
  nextGuests: number
}): boolean {
  if (!registrationHoldsSeat(input.previousStatus)) return false
  if (!registrationHoldsSeat(input.nextStatus)) return true
  return input.nextGuests < input.previousGuests
}

export function registrationStatusLabel(status: string): string {
  switch (status) {
    case 'waitlisted':
      return 'On waitlist'
    case 'pending':
      return 'Awaiting approval'
    case 'pending_payment':
      return 'Pending payment'
    case 'cancelled':
      return 'Cancelled'
    case 'registered':
      return 'Registered'
    default:
      return 'Registered'
  }
}

export function registrationStatusSentence(status: string): string {
  switch (status) {
    case 'waitlisted':
      return 'You are on the waitlist'
    case 'pending':
      return 'Your signup is awaiting approval'
    case 'pending_payment':
      return 'Complete payment to finish your registration'
    case 'registered':
      return 'You are already registered'
    default:
      return 'You are already registered'
  }
}

/** Form success line when the signup is not a confirmed seat. */
export function publicSignupAck(status: string): string | undefined {
  if (status === 'pending') return 'Your signup is awaiting approval.'
  if (status === 'waitlisted') return 'You are on the waitlist.'
  return undefined
}

/** Public create path when capacity is exhausted and waitlist is off. */
export const EVENT_FULL_WAITLIST_CLOSED =
  'This event is full and the waitlist is closed.'

/**
 * Capacity gate for a new signup. Callers that serialize count+insert
 * (DB transaction or in-memory bag) must evaluate this against a fresh count.
 */
export function evaluateRegistrationCapacity(input: {
  occupiedEvent: number
  eventCapacity: number | null | undefined
  occupiedTier: number
  tierCapacity: number | null | undefined
  guests: number
  waitlistEnabled: boolean
}): { needsWaitlist: boolean } | { error: string } {
  const guests = Math.max(1, Math.floor(input.guests) || 1)
  let needsWaitlist = false
  if (typeof input.eventCapacity === 'number' && input.eventCapacity >= 0) {
    if (
      input.occupiedEvent >= input.eventCapacity ||
      input.occupiedEvent + guests > input.eventCapacity
    ) {
      needsWaitlist = true
    }
  }
  if (!needsWaitlist && typeof input.tierCapacity === 'number') {
    if (
      input.occupiedTier >= input.tierCapacity ||
      input.occupiedTier + guests > input.tierCapacity
    ) {
      needsWaitlist = true
    }
  }
  if (needsWaitlist && !input.waitlistEnabled) {
    return { error: EVENT_FULL_WAITLIST_CLOSED }
  }
  return { needsWaitlist }
}

/** In-memory registration row for last-seat race tests. */
export type RegistrationSeatBagRow = {
  id: string
  eventId: string
  ticketTierId: string | null
  guests: number
  status: RegistrationStatus
}

export type RegistrationSeatBag = {
  rows: RegistrationSeatBagRow[]
}

function countOccupiedGuestsInBag(
  bag: RegistrationSeatBag,
  eventId: string,
  ticketTierId?: string | null,
): number {
  const tier = (ticketTierId || '').trim() || null
  let n = 0
  for (const row of bag.rows) {
    if (row.eventId !== eventId) continue
    if (!registrationHoldsSeat(row.status)) continue
    if (tier && row.ticketTierId !== tier) continue
    n += Math.max(1, row.guests)
  }
  return n
}

/**
 * Atomic count+insert for unit tests (stands in for the DB transaction).
 * Two overlapping callers must share one bag and serialize through this helper.
 */
export function claimRegistrationSeatInBag(
  bag: RegistrationSeatBag,
  input: {
    id: string
    eventId: string
    ticketTierId?: string | null
    guests?: number
    eventCapacity: number | null
    tierCapacity?: number | null
    waitlistEnabled: boolean
    requireApproval?: boolean
  },
): { registration: RegistrationSeatBagRow } | { error: string } {
  const guests =
    typeof input.guests === 'number' && Number.isFinite(input.guests) && input.guests > 0
      ? Math.floor(input.guests)
      : 1
  const ticketTierId = (input.ticketTierId || '').trim() || null
  const occupiedEvent = countOccupiedGuestsInBag(bag, input.eventId)
  const occupiedTier = ticketTierId
    ? countOccupiedGuestsInBag(bag, input.eventId, ticketTierId)
    : 0
  const capacity = evaluateRegistrationCapacity({
    occupiedEvent,
    eventCapacity: input.eventCapacity,
    occupiedTier,
    tierCapacity: ticketTierId ? input.tierCapacity : null,
    guests,
    waitlistEnabled: input.waitlistEnabled,
  })
  if ('error' in capacity) return capacity
  const status = resolveInitialRegistrationStatus({
    needsWaitlist: capacity.needsWaitlist,
    requireApproval: Boolean(input.requireApproval),
  })
  const registration: RegistrationSeatBagRow = {
    id: input.id,
    eventId: input.eventId,
    ticketTierId,
    guests,
    status,
  }
  bag.rows.push(registration)
  return { registration }
}
