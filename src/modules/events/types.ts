/**
 * product:events shared types — venues + events + parties.
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

/** Absolute ceiling for guests on one registration when a tier has no maxPerBooking. */
export const DEFAULT_MAX_TICKETS_PER_BOOKING = 20

export function isTicketTierKind(value: unknown): value is TicketTierKind {
  return value === 'general' || value === 'faction'
}

export const EVENT_PARTY_KINDS = ['organizer', 'speaker', 'sponsor', 'other'] as const

export type EventPartyKind = (typeof EVENT_PARTY_KINDS)[number]

export function isEventPartyKind(value: unknown): value is EventPartyKind {
  return (
    typeof value === 'string' &&
    (EVENT_PARTY_KINDS as readonly string[]).includes(value)
  )
}

export type VenueRecord = {
  id: string
  name: string
  address: string
  description: string
  /** WGS84 — null until set / geocoded. */
  latitude: number | null
  longitude: number | null
  coverMediaId: string
  galleryMediaIds: string[]
  accessTags: string[]
  createdAt: Date
  updatedAt: Date
}

export type EventPartyRecord = {
  id: string
  name: string
  kind: EventPartyKind
  url: string
  blurb: string
  avatarMediaId: string
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
  /** When full, public signup may join waitlist; FIFO promote when seats free. */
  waitlistEnabled: boolean
  /** When public signup opens (null = as soon as published). */
  registrationOpensAt: Date | null
  /** When public signup closes (null = until event ends / no hard close). */
  registrationClosesAt: Date | null
  /** Premium merchant user collecting ticket payments (null = site MoR). */
  merchantUserId: string
  managerUserIds: string[]
  helperUserIds: string[]
  managerGroupIds: string[]
  helperGroupIds: string[]
  organizerPartyIds: string[]
  speakerPartyIds: string[]
  sponsorPartyIds: string[]
  relatedEventIds: string[]
  signupNote: string
  termsUrl: string
  /** When false, omit from public discovery lists (URL still works). */
  listed: boolean
  /** When true, eligible for the Featured carousel particle. */
  featured: boolean
  /** True when a shared access password is set (hash never exposed). */
  hasAccessPassword: boolean
  accessTags: string[]
  createdAt: Date
  updatedAt: Date
}

/** How ticket/faction area cards show capacity on the public event page. */
export const TIER_CAPACITY_DISPLAY_MODES = ['both', 'free', 'occupied_max'] as const
export type TierCapacityDisplayMode = (typeof TIER_CAPACITY_DISPLAY_MODES)[number]

export function isTierCapacityDisplayMode(value: unknown): value is TierCapacityDisplayMode {
  return (
    typeof value === 'string' &&
    (TIER_CAPACITY_DISPLAY_MODES as readonly string[]).includes(value)
  )
}

/** Module settings document in `sf_module_settings` (id = product:events). */
export type EventsModuleSettings = {
  /** Default IANA timezone for new events. */
  defaultTimezone: string
  /** Block second signup with the same email on one event. */
  preventDuplicate: boolean
  /** Public area-card capacity lines: occupied/max, free left, or both. */
  tierCapacityDisplay: TierCapacityDisplayMode
}

export const DEFAULT_EVENTS_MODULE_SETTINGS: EventsModuleSettings = {
  defaultTimezone: 'UTC',
  preventDuplicate: true,
  tierCapacityDisplay: 'both',
}

export type EventsAdminActionState = {
  error?: string
  ok?: boolean
  message?: string
  id?: string
  /** Post-save UX: apply → stay/open editor; save → back to list default. */
  after?: 'apply' | 'save'
}
