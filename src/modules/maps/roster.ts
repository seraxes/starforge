/**
 * Fill a TacMap room's teams from rows Events already resolved.
 * Writes `sf_map_*` only. Does not remove members an admin added by hand.
 */

import 'server-only'

import type { RoomRosterSeedResult } from './event-catalog'
import {
  createTeam,
  listTeamMemberUserIds,
  listTeamsForRoom,
  setTeamMembers,
} from './store'

export type RoomRosterTeam = {
  ticketTierId: string
  name: string
  sortOrder: number
  userIds: string[]
}

const TEAM_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#eab308', '#a855f7', '#06b6d4']

/**
 * Create a missing team per row and merge that row's user ids into the roster.
 * An existing team for the same ticket tier is left in place, including its name.
 */
export async function replaceRoomRoster(
  roomId: string,
  rows: readonly RoomRosterTeam[],
): Promise<RoomRosterSeedResult> {
  const existing = await listTeamsForRoom(roomId)
  const byTier = new Map(
    existing
      .filter((team) => team.ticketTierId)
      .map((team) => [team.ticketTierId, team] as const),
  )

  let teamsCreated = 0
  let membersAdded = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    const tierId = row.ticketTierId.trim()
    if (!tierId) continue

    let team = byTier.get(tierId)
    if (!team) {
      team = await createTeam({
        roomId,
        name: row.name.trim() || `Team ${i + 1}`,
        color: TEAM_COLORS[i % TEAM_COLORS.length],
        sortOrder: row.sortOrder ?? i,
        ticketTierId: tierId,
      })
      byTier.set(tierId, team)
      teamsCreated++
    }

    const incoming = [
      ...new Set(row.userIds.map((id) => id.trim()).filter(Boolean)),
    ]
    if (!incoming.length) continue

    const current = await listTeamMemberUserIds(team.id)
    const currentSet = new Set(current)
    const merged = [...new Set([...current, ...incoming])]
    const added = merged.filter((id) => !currentSet.has(id)).length
    if (added > 0) {
      await setTeamMembers(team.id, merged)
      membersAdded += added
    }
  }

  return { teamsCreated, membersAdded }
}
