/**
 * Event catalog slot for product:maps.
 *
 * Maps renders markers and admin labels it is given. Events registers the
 * implementation at boot. Until then every read is empty and roster seeding
 * is a no-op. This file does not import Events or the database.
 */

import type { MapMarker } from '@/core/maps/types'

/** Registrant row the catalog returns. Events owns the real records. */
export type RosterRow = {
  userId: string
  ticketTierId: string
  status: string
}

/**
 * Maps asks Events for pins, admin event labels, and a roster.
 * Stage 2A registers the implementation. Until then the slot is empty.
 */
export type EventCatalog = {
  listPublishedVenues(): Promise<MapMarker[]>
  listEventsForAdmin(): Promise<Array<{ id: string; label: string }>>
  findEventForAdmin(id: string): Promise<{ id: string; label: string } | null>
  listRoster(eventId: string): Promise<RosterRow[]>
}

export type RoomRosterSeedResult = {
  teamsCreated: number
  membersAdded: number
}

/**
 * Events-owned seed command. TacMap actions call this so Maps never imports
 * Events. The implementation loads factions and registrations, then calls
 * `replaceRoomRoster`.
 */
export type RoomRosterSeeder = (
  roomId: string,
  eventId: string,
) => Promise<RoomRosterSeedResult>

const emptyEventCatalog: EventCatalog = {
  async listPublishedVenues() {
    return []
  },
  async listEventsForAdmin() {
    return []
  },
  async findEventForAdmin() {
    return null
  },
  async listRoster() {
    return []
  },
}

const emptySeedResult: RoomRosterSeedResult = {
  teamsCreated: 0,
  membersAdded: 0,
}

let eventCatalog: EventCatalog = emptyEventCatalog
let roomRosterSeeder: RoomRosterSeeder | null = null

/** Replace the catalog. A later register call overwrites the previous one. */
export function registerEventCatalog(catalog: EventCatalog): void {
  eventCatalog = catalog
}

/** Registered catalog, or the empty catalog when nobody has registered. */
export function listEventCatalog(): EventCatalog {
  return eventCatalog
}

/** Replace the roster seeder. Pass null to clear it. */
export function registerRoomRosterSeeder(seeder: RoomRosterSeeder | null): void {
  roomRosterSeeder = seeder
}

/** Run the registered seeder, or return an empty result when Events is absent. */
export async function seedRoomRosterFromEvent(
  roomId: string,
  eventId: string,
): Promise<RoomRosterSeedResult> {
  if (!roomRosterSeeder) return emptySeedResult
  return roomRosterSeeder(roomId, eventId)
}
