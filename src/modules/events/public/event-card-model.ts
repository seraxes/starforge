/**
 * Public event card / hub view-model builders (product:events).
 */

import 'server-only'

import { withLocalePrefix } from '@/core/i18n/path'
import type { AppLocale } from '@/core/i18n/locales'

import {
  countRegisteredGuests,
  isEventRegistrationOpen,
  type EventRegistrationRecord,
} from '../registrations'
import { listPublicTicketTiersForEvent } from '../public-tiers'
import type { EventPartyRecord, EventRecord, VenueRecord } from '../types'
import { formatEventWhen } from './format'
import { eventPublicPathKey } from './path'

export type EventSignupStatus = 'none' | 'registered' | 'waitlisted'

export type EventCardModel = {
  id: string
  title: string
  slug: string
  href: string
  whenLabel: string
  startsAt: Date | null
  endsAt: Date | null
  timezone: string
  venueId: string
  venueName: string
  venueAddress: string
  latitude: number | null
  longitude: number | null
  coverMediaId: string
  capacity: number | null
  occupied: number
  remaining: number | null
  priceLabel: string
  registrationOpen: boolean
  registrationReason?: string
  signupStatus: EventSignupStatus
  organizerPartyIds: string[]
  organizerNames: string[]
}

export type BuildEventCardOptions = {
  locale?: AppLocale
  venuesById: Map<string, VenueRecord>
  partiesById?: Map<string, EventPartyRecord>
  /** eventId → viewer signup status */
  signupByEventId?: Map<string, EventSignupStatus>
  /** Precomputed guest counts (optional batch). */
  occupiedByEventId?: Map<string, number>
  /** Precomputed cheapest price label per event. */
  priceByEventId?: Map<string, string>
}

function signupFromRegistration(
  row: EventRegistrationRecord | null | undefined,
): EventSignupStatus {
  if (!row) return 'none'
  if (row.status === 'waitlisted') return 'waitlisted'
  if (row.status === 'registered') return 'registered'
  return 'none'
}

export function signupStatusMapFromRegistrations(
  rows: EventRegistrationRecord[],
): Map<string, EventSignupStatus> {
  const map = new Map<string, EventSignupStatus>()
  for (const row of rows) {
    if (map.has(row.eventId)) continue
    map.set(row.eventId, signupFromRegistration(row))
  }
  return map
}

/** Cheapest non-empty priceLabel among tiers (first when tied). */
export async function resolvePriceLabelForEvent(eventId: string): Promise<string> {
  const tiers = await listPublicTicketTiersForEvent(eventId)
  for (const tier of tiers) {
    const label = tier.priceLabel.trim()
    if (label) return label
  }
  return ''
}

export async function buildEventCardModel(
  event: EventRecord,
  options: BuildEventCardOptions,
): Promise<EventCardModel> {
  const venue = event.venueId ? options.venuesById.get(event.venueId) : undefined
  const window = isEventRegistrationOpen(event)
  const occupied =
    options.occupiedByEventId?.get(event.id) ?? (await countRegisteredGuests(event.id))
  const remaining =
    typeof event.capacity === 'number' ? Math.max(0, event.capacity - occupied) : null
  const priceLabel =
    options.priceByEventId?.get(event.id) ?? (await resolvePriceLabelForEvent(event.id))

  const organizerNames: string[] = []
  for (const id of event.organizerPartyIds) {
    const party = options.partiesById?.get(id)
    if (party?.name) organizerNames.push(party.name)
  }

  return {
    id: event.id,
    title: event.title,
    slug: event.slug,
    href: withLocalePrefix(
      `/events/${encodeURIComponent(eventPublicPathKey(event))}`,
      options.locale,
    ),
    whenLabel: formatEventWhen(event.startsAt, event.endsAt, event.timezone),
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    timezone: event.timezone,
    venueId: event.venueId || '',
    venueName: venue?.name || '',
    venueAddress: venue?.address || '',
    latitude: venue?.latitude ?? null,
    longitude: venue?.longitude ?? null,
    coverMediaId: event.coverMediaId || '',
    capacity: event.capacity,
    occupied,
    remaining,
    priceLabel,
    registrationOpen: window.open,
    registrationReason: window.reason,
    signupStatus: options.signupByEventId?.get(event.id) ?? 'none',
    organizerPartyIds: [...event.organizerPartyIds],
    organizerNames,
  }
}

export async function buildEventCardModels(
  events: EventRecord[],
  options: BuildEventCardOptions,
): Promise<EventCardModel[]> {
  return Promise.all(events.map((event) => buildEventCardModel(event, options)))
}
