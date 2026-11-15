/**
 * Events implementation of the Maps event catalog.
 * Registered from Events boot (`bootEvents` via generated `runModuleBoot`).
 */

import 'server-only'

import { getLocale } from 'next-intl/server'

import type { MapMarker } from '@/core/maps/types'
import { isAppLocale } from '@/core/i18n/locales'
import { withLocalePrefix } from '@/core/i18n/path'
import {
  registerEventCatalog,
  registerRoomRosterSeeder,
} from '@/modules/maps/api.server'

import { eventPublicPathKey } from './public/path'
import { listRegistrationsForEvent } from './registrations'
import { seedRoomFromEventFactions } from './seed-map-room'
import { findEventById, findVenueById, listEvents, listPublishedEvents } from './store'

function adminEventLabel(title: string, status: string): string {
  return `${title} (${status})`
}

async function listPublishedVenues(): Promise<MapMarker[]> {
  try {
    const localeRaw = await getLocale()
    const locale = isAppLocale(localeRaw) ? localeRaw : undefined
    const events = await listPublishedEvents({ limit: 40, includePast: false })
    const markers: MapMarker[] = []
    const seen = new Set<string>()
    for (const event of events) {
      if (!event.venueId || seen.has(event.venueId)) continue
      seen.add(event.venueId)
      const venue = await findVenueById(event.venueId)
      if (!venue?.latitude || !venue?.longitude) continue
      markers.push({
        id: venue.id,
        lat: venue.latitude,
        lng: venue.longitude,
        label: venue.name,
        href: withLocalePrefix(
          `/events/${encodeURIComponent(eventPublicPathKey(event))}`,
          locale,
        ),
      })
    }
    return markers
  } catch {
    return []
  }
}

/** Register venue pins, admin labels, roster reads, and faction seeding. */
export function ensureEventsMapCatalog(): void {
  registerEventCatalog({
    listPublishedVenues,
    async listEventsForAdmin() {
      const events = await listEvents()
      return events.map((event) => ({
        id: event.id,
        label: adminEventLabel(event.title, event.status),
      }))
    },
    async findEventForAdmin(id) {
      const event = await findEventById(id)
      if (!event) return null
      return { id: event.id, label: event.title }
    },
    async listRoster(eventId) {
      const registrations = await listRegistrationsForEvent(eventId)
      return registrations
        .filter((row) => row.userId.trim())
        .map((row) => ({
          userId: row.userId.trim(),
          ticketTierId: row.ticketTierId,
          status: row.status,
        }))
    },
  })
  registerRoomRosterSeeder(seedRoomFromEventFactions)
}
