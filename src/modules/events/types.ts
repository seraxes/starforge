/**
 * product:events shared types — venues + events + parties.
 */

import type { TierPriceRules } from './price-rules'
import type { EventSeriesPattern } from './series'

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

/** How the public cover hero picks among coverMediaIds (random/rotate = Premium later). */
export const EVENT_COVER_DISPLAY_MODES = ['static', 'random', 'rotate'] as const
export type EventCoverDisplayMode = (typeof EVENT_COVER_DISPLAY_MODES)[number]
export const EVENT_COVER_MEDIA_MAX = 10

export function isEventCoverDisplayMode(value: unknown): value is EventCoverDisplayMode {
  return (
    typeof value === 'string' &&
    (EVENT_COVER_DISPLAY_MODES as readonly string[]).includes(value)
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

/** Editorial category. Translations live in content-locale files, not on this row. */
export type EventCategoryRecord = {
  id: string
  title: string
  slug: string
  description: string
  /** Empty = shared event-registration form for events in this category. */
  registrationFormId: string
  published: boolean
  sortOrder: number
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
  /** ISO currency for this event. Empty inherits Payments site currency. */
  currency: string
  /** Event base price in major units. Null = no event base. */
  price: number | null
  /** Time-left bands and one sold-count rule. Percent is of the price in effect. */
  priceRules: TierPriceRules
  venueId: string
  description: string
  /** Primary cover (first of coverMediaIds; kept for list/cards). */
  coverMediaId: string
  /** Up to 10 cover images for Premium random/rotate slider (playback later). */
  coverMediaIds: string[]
  /** static = first image; random/rotate = Premium (UI saved now, public playback later). */
  coverDisplayMode: EventCoverDisplayMode
  galleryMediaIds: string[]
  capacity: number | null
  /** When full, public signup may join waitlist; FIFO promote when seats free. */
  waitlistEnabled: boolean
  /**
   * When true, a free seat stays pending until an admin sets it registered.
   * Paid tickets still hold as pending_payment until paid, then pending.
   */
  requireApproval: boolean
  /** When public signup opens (null = as soon as published). */
  registrationOpensAt: Date | null
  /** When public signup closes (null = until event ends / no hard close). */
  registrationClosesAt: Date | null
  /** Self-cancel / Switch-to until this time (null = disabled). */
  cancellationClosesAt: Date | null
  /** Offer confirmed refund request on self-cancel when a paid order exists. */
  selfCancelRefund: boolean
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
  /**
   * Shared series id for recurring copies (usually the first occurrence id).
   * Empty = standalone. Related events stay a separate see-also list.
   */
  seriesId: string
  /** Pattern stored on the series root only; null on standalone / non-root copies. */
  seriesPattern: EventSeriesPattern | null
  signupNote: string
  termsUrl: string
  /** When false, omit from public discovery lists (URL still works). */
  listed: boolean
  /** When true, eligible for the Featured carousel particle. */
  featured: boolean
  /** Editorial category id. Empty = uncategorized. */
  categoryId: string
  /**
   * Registration form override.
   * Empty inherits the category form, then the shared event-registration form.
   */
  registrationFormId: string
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
