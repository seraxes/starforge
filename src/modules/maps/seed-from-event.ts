/**
 * Optional seed: faction ticket tiers → teams + registrants → roster.
 * Explicit roster remains the live ACL source of truth after seeding.
 */

import 'server-only'

import { listRegistrationsForEvent } from '@/modules/events/registrations'
import { listTicketTiersForEvent } from '@/modules/events/tiers'

import {
  createTeam,
  listTeamMemberUserIds,
  listTeamsForRoom,
  setTeamMembers,
} from './store'

export type SeedFromEventResult = {
  teamsCreated: number
  membersAdded: number
}

/**
 * Create missing teams from faction tiers and merge registrant user ids into roster.
 * Does not remove existing members.
 */
export async function seedRoomFromEventFactions(
  roomId: string,
  eventId: string,
): Promise<SeedFromEventResult> {
  const tiers = await listTicketTiersForEvent(eventId)
  const factions = tiers.filter((t) => t.kind === 'faction')
  const existing = await listTeamsForRoom(roomId)
  const byTier = new Map(
    existing
      .filter((t) => t.ticketTierId)
      .map((t) => [t.ticketTierId, t] as const),
  )

  let teamsCreated = 0
  const colors = ['#3b82f6', '#ef4444', '#22c55e', '#eab308', '#a855f7', '#06b6d4']

  for (let i = 0; i < factions.length; i++) {
    const tier = factions[i]!
    if (byTier.has(tier.id)) continue
    const team = await createTeam({
      roomId,
      name: tier.title || `Team ${i + 1}`,
      color: colors[i % colors.length],
      sortOrder: tier.sortOrder ?? i,
      ticketTierId: tier.id,
    })
    byTier.set(tier.id, team)
    teamsCreated++
  }

  const registrations = await listRegistrationsForEvent(eventId)
  let membersAdded = 0

  for (const tier of factions) {
    const team = byTier.get(tier.id)
    if (!team) continue
    const current = await listTeamMemberUserIds(team.id)
    const currentSet = new Set(current)
    const fromRegs = registrations
      .filter(
        (r) =>
          r.ticketTierId === tier.id &&
          r.userId &&
          (r.status === 'registered' || r.status === 'waitlisted'),
      )
      .map((r) => r.userId.trim())
      .filter(Boolean)

    const merged = [...new Set([...current, ...fromRegs])]
    const added = merged.filter((id) => !currentSet.has(id)).length
    if (added > 0) {
      await setTeamMembers(team.id, merged)
      membersAdded += added
    }
  }

  return { teamsCreated, membersAdded }
}
