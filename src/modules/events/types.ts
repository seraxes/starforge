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

export type VenueRecord = {
  id: string
  name: string
  address: string
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
  accessTags: string[]
  createdAt: Date
  updatedAt: Date
}

/** Module settings document in `sf_module_settings` (id = product:events). */
export type EventsModuleSettings = {
  /** Default IANA timezone for new events. */
  defaultTimezone: string
}

export const DEFAULT_EVENTS_MODULE_SETTINGS: EventsModuleSettings = {
  defaultTimezone: 'UTC',
}

export type EventsAdminActionState = {
  error?: string
  ok?: boolean
  message?: string
  id?: string
}
