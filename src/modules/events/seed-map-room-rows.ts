/**
 * Faction tiers and registrations → team rows for Maps `replaceRoomRoster`.
 * Pure. Events loads the records; Maps writes `sf_map_*`.
 */

export type FactionTierSeed = {
  id: string
  title: string
  sortOrder: number
  kind: string
}

export type RegistrationSeed = {
  userId: string
  ticketTierId: string
  status: string
}

export type FactionRosterRow = {
  ticketTierId: string
  name: string
  sortOrder: number
  userIds: string[]
}

const ROSTER_STATUSES = new Set(['registered', 'waitlisted'])

/** One row per faction tier. General tiers and other statuses are left out. */
export function buildFactionRosterRows(
  tiers: readonly FactionTierSeed[],
  registrations: readonly RegistrationSeed[],
): FactionRosterRow[] {
  const factions = tiers.filter((tier) => tier.kind === 'faction')
  return factions.map((tier, index) => {
    const userIds = registrations
      .filter(
        (row) =>
          row.ticketTierId === tier.id &&
          row.userId &&
          ROSTER_STATUSES.has(row.status),
      )
      .map((row) => row.userId.trim())
      .filter(Boolean)
    return {
      ticketTierId: tier.id,
      name: tier.title || `Team ${index + 1}`,
      sortOrder: tier.sortOrder ?? index,
      userIds,
    }
  })
}
