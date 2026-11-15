/**
 * product:maps server door.
 *
 * Room read/write for live map routes, the event catalog slot, and
 * `replaceRoomRoster` (Events passes resolved team rows; this pack writes
 * `sf_map_*`). The catalog stays empty until Events registers one.
 * This file does not import client components or Events.
 *
 *   import { findMapRoomById, registerEventCatalog, replaceRoomRoster } from '@/modules/maps/api.server'
 *
 * EventLiveMap stays on `@/modules/maps`. A static re-export here would load
 * the Leaflet client graph (including `leaflet.css`) for every server-door
 * import. Node boot cannot load that CSS file.
 */

import 'server-only'

export {
  createTeam,
  findActiveSession,
  findMapRoomById,
  findMembershipForUserInRoom,
  isPositionStale,
  joinMapSession,
  leaveActiveSessionForUser,
  listTeamMemberUserIds,
  listTeamPositions,
  listTeamsForRoom,
  MAP_POSITION_STALE_MS,
  setTeamMembers,
  upsertPosition,
  userIsRoomManager,
} from './store'

export { mapTeamChannel } from './channels'

export { canSubscribeMapChannel } from './realtime-acl'

export {
  listEventCatalog,
  registerEventCatalog,
  registerRoomRosterSeeder,
  seedRoomRosterFromEvent,
  type EventCatalog,
  type RoomRosterSeedResult,
  type RoomRosterSeeder,
  type RosterRow,
} from './event-catalog'

export { replaceRoomRoster, type RoomRosterTeam } from './roster'
