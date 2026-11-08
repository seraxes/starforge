/**
 * Shared public card loading for hub views + layout particles.
 */

import 'server-only'

import type { AccessViewer } from '@/core/acl/types'
import type { AppLocale } from '@/core/i18n/locales'

import {
  countRegisteredGuests,
  listActiveRegistrationsForUser,
} from '../registrations'
import {
  filterEventsForViewer,
  findVenueById,
  listPublishedEvents,
} from '../store'
import type { EventRecord, VenueRecord } from '../types'
import {
  buildEventCardModels,
  resolvePriceLabelForEvent,
  signupStatusMapFromRegistrations,
  type EventCardModel,
} from './event-card-model'

export type LoadEventCardsOptions = {
  locale?: AppLocale
  viewer: AccessViewer
  limit?: number
  includePast?: boolean
  featuredOnly?: boolean
}

export async function loadPublicEventCards(
  options: LoadEventCardsOptions,
): Promise<{ events: EventRecord[]; cards: EventCardModel[] }> {
  const raw = await listPublishedEvents({
    limit: options.limit ?? 100,
    includePast: options.includePast === true,
    featuredOnly: options.featuredOnly === true,
  })
  const events = filterEventsForViewer(raw, options.viewer)

  const venuesById = new Map<string, VenueRecord>()
  await Promise.all(
    [...new Set(events.map((e) => e.venueId).filter(Boolean))].map(async (id) => {
      const venue = await findVenueById(id)
      if (venue) venuesById.set(venue.id, venue)
    }),
  )

  const myRegs = options.viewer.userId
    ? await listActiveRegistrationsForUser(options.viewer.userId)
    : []
  const signupByEventId = signupStatusMapFromRegistrations(myRegs)

  const occupiedByEventId = new Map<string, number>()
  const priceByEventId = new Map<string, string>()
  await Promise.all(
    events.map(async (event) => {
      const [occupied, price] = await Promise.all([
        countRegisteredGuests(event.id),
        resolvePriceLabelForEvent(event.id),
      ])
      occupiedByEventId.set(event.id, occupied)
      priceByEventId.set(event.id, price)
    }),
  )

  const cards = await buildEventCardModels(events, {
    locale: options.locale,
    venuesById,
    signupByEventId,
    occupiedByEventId,
    priceByEventId,
  })

  return { events, cards }
}
