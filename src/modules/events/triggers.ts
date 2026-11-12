/** Email Manager trigger keys owned by product:events. */

export const EVENTS_REGISTERED_TRIGGER = 'product:events/registered' as const

export const EVENTS_WAITLIST_PROMOTED_TRIGGER =
  'product:events/waitlist-promoted' as const

export const EVENTS_ORGANIZER_NOTIFY_TRIGGER =
  'product:events/organizer-notify' as const

export const EVENTS_ATTENDEE_REMINDER_TRIGGER =
  'product:events/attendee-reminder' as const

export const EVENTS_REGISTRANT_CANCELLED_TRIGGER =
  'product:events/registrant-cancelled' as const

/** JobRunner handler name — fires attendee-reminder before event start. */
export const EVENTS_ATTENDEE_REMINDER_JOB = 'events.attendee-reminder' as const

/** JobRunner handler — expire abandoned online ticket checkouts. */
export const EVENTS_ABANDONED_CHECKOUT_JOB = 'events.abandoned-checkout-sweep' as const

/** How often the abandoned-checkout sweep reschedules itself. */
export const EVENTS_ABANDONED_CHECKOUT_SWEEP_MS = 60_000

/** Default lead time for attendee reminder (hours before startsAt). */
export const EVENTS_REMINDER_HOURS_BEFORE = 24
