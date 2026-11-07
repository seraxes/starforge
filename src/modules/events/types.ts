/**
 * product:events shared types — venues + events admin CRUD (PR1).
 */

export const EVENT_STATUSES = ['draft', 'published', 'cancelled'] as const

export type EventStatus = (typeof EVENT_STATUSES)[number]

export function isEventStatus(value: unknown): value is EventStatus {
  return (
    typeof value === 'string' &&
    (EVENT_STATUSES as readonly string[]).includes(value)
  )
}

/** Ticket / faction slot kinds (densify). */
export const TICKET_TIER_KINDS = ['general', 'faction'] as const

export type TicketTierKind = (typeof TICKET_TIER_KINDS)[number]

export function isTicketTierKind(value: unknown): value is TicketTierKind {
  return value === 'general' || value === 'faction'
}

export type VenueRecord = {
  id: string
  name: string
  address: string
  /** WGS84 — null until set / geocoded. */
  latitude: number | null
  longitude: number | null
  coverMediaId: string
  accessTags: string[]
  createdAt: Date
  updatedAt: Date
}

export type EventRecord = {
  id: string
  title: string
  slug: string
  status: EventStatus
  startsAt: Date | null
  endsAt: Date | null
  timezone: string
  venueId: string
  description: string
  coverMediaId: string
  galleryMediaIds: string[]
  capacity: number | null
  /** When public signup opens (null = as soon as published). */
  registrationOpensAt: Date | null
  /** When public signup closes (null = until event ends / no hard close). */
  registrationClosesAt: Date | null
  accessTags: string[]
  createdAt: Date
  updatedAt: Date
}

/** Module settings document in `sf_module_settings` (id = product:events). */
export type EventsModuleSettings = {
  /** Default IANA timezone for new events. */
  defaultTimezone: string
  /** Block second signup with the same email on one event. */
  preventDuplicate: boolean
}

export const DEFAULT_EVENTS_MODULE_SETTINGS: EventsModuleSettings = {
  defaultTimezone: 'UTC',
  preventDuplicate: true,
}

export type EventsAdminActionState = {
  error?: string
  ok?: boolean
  message?: string
  id?: string
}
