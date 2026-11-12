/**
 * Public signup badges (product:events). Client-safe.
 */

export type EventSignupStatus =
  | 'none'
  | 'registered'
  | 'pending'
  | 'waitlisted'
  | 'pending_payment'

export function signupStatusFromRegistrationStatus(
  status: string | null | undefined,
): EventSignupStatus {
  if (
    status === 'registered' ||
    status === 'pending' ||
    status === 'waitlisted' ||
    status === 'pending_payment'
  ) {
    return status
  }
  return 'none'
}

/** Card / list CTA when the viewer already has a signup. */
export function signupCtaLabel(status: EventSignupStatus): string {
  switch (status) {
    case 'registered':
      return 'Already registered'
    case 'pending':
      return 'Awaiting approval'
    case 'pending_payment':
      return 'Pending payment'
    case 'waitlisted':
      return 'On waitlist'
    default:
      return 'Register'
  }
}

/** Current ticket-type card when there is no manage link. */
export function signupTicketHint(status: EventSignupStatus): string {
  switch (status) {
    case 'waitlisted':
      return 'Waitlisted'
    case 'pending':
      return 'Awaiting approval'
    case 'pending_payment':
      return 'Pending payment'
    case 'registered':
      return 'Your registration'
    default:
      return ''
  }
}

/** Other ticket cards while the viewer already holds a signup. */
export function signupBlockedLabel(status: EventSignupStatus): string {
  switch (status) {
    case 'waitlisted':
      return 'Waitlisted'
    case 'pending':
      return 'Awaiting approval'
    case 'pending_payment':
      return 'Pending payment'
    default:
      return 'Already registered'
  }
}
