/**
 * Pure Marketplace dashboard listing counts.
 * No db — unit tests fold fixture rows here without Postgres.
 */

import type { DashboardStatsResult } from '@/core/dashboard'

import { matchesPublicListingQuery } from '../listing-rules'

export const MARKETPLACE_LISTINGS_STAT_KEYS = ['active', 'new7d', 'pending'] as const

export type MarketplaceListingsStatKey = (typeof MARKETPLACE_LISTINGS_STAT_KEYS)[number]

/** One listing row shaped for the dashboard fold (joined category enabled). */
export type MarketplaceListingsCountRow = {
  status: string
  categoryEnabled: boolean
  expiresAt: Date | null | undefined
  createdAt: Date | null | undefined
}

export type MarketplaceListingsCounts = Record<MarketplaceListingsStatKey, number>

export const MARKETPLACE_NEW_7D_MS = 7 * 24 * 60 * 60_000

/** Zeroed counts for an empty successful aggregate (not for unavailable). */
export function emptyMarketplaceListingsCounts(): MarketplaceListingsCounts {
  return { active: 0, new7d: 0, pending: 0 }
}

/**
 * Map listing fixtures to dashboard counts:
 * - active: public predicate (active + category enabled + expiresAt in the future)
 * - new7d: created in the last seven days and status is not removed
 * - pending: status pending
 */
export function countMarketplaceListingsStats(
  rows: ReadonlyArray<MarketplaceListingsCountRow>,
  now: Date,
): MarketplaceListingsCounts {
  const counts = emptyMarketplaceListingsCounts()
  const since7d = now.getTime() - MARKETPLACE_NEW_7D_MS

  for (const row of rows) {
    if (
      matchesPublicListingQuery({
        status: row.status,
        categoryEnabled: row.categoryEnabled,
        expiresAt: row.expiresAt,
        now,
      })
    ) {
      counts.active += 1
    }

    if (row.status === 'pending') {
      counts.pending += 1
    }

    const createdMs =
      row.createdAt instanceof Date && Number.isFinite(row.createdAt.getTime())
        ? row.createdAt.getTime()
        : null
    if (createdMs != null && createdMs >= since7d && row.status !== 'removed') {
      counts.new7d += 1
    }
  }

  return counts
}

/**
 * Resolve glance byKey from a stats result.
 * Unavailable / failed stays null per key — never coerce to zeros.
 */
export function marketplaceListingsByKeyFromResult(
  result: DashboardStatsResult<{
    byKey: Record<MarketplaceListingsStatKey, number | null>
  }>,
): Record<MarketplaceListingsStatKey, number | null> {
  if (!result.ok) {
    return { active: null, new7d: null, pending: null }
  }
  return {
    active: result.data.byKey.active,
    new7d: result.data.byKey.new7d,
    pending: result.data.byKey.pending,
  }
}
