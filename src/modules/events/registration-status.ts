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
