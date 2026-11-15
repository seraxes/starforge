/**
 * Seed a TacMap room from an event's faction tiers and registrants.
 * Events owns the read. Maps `replaceRoomRoster` owns the `sf_map_*` write.
 */

import 'server-only'

import { replaceRoomRoster } from '@/modules/maps/api.server'

import { listRegistrationsForEvent } from './registrations'
import { buildFactionRosterRows } from './seed-map-room-rows'
import { listTicketTiersForEvent } from './tiers'

export async function seedRoomFromEventFactions(
  roomId: string,
  eventId: string,
): Promise<{ teamsCreated: number; membersAdded: number }> {
  const [tiers, registrations] = await Promise.all([
    listTicketTiersForEvent(eventId),
    listRegistrationsForEvent(eventId),
  ])
  return replaceRoomRoster(roomId, buildFactionRosterRows(tiers, registrations))
}
