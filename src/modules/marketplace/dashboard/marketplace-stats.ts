import 'server-only'

import type { DashboardStatsResult } from '@/core/dashboard'

import type { MarketplaceListingsStatKey } from './marketplace-listings-counts'

export {
  countMarketplaceListingsStats,
  emptyMarketplaceListingsCounts,
  marketplaceListingsByKeyFromResult,
  MARKETPLACE_NEW_7D_MS,
} from './marketplace-listings-counts'

/** Soft Marketplace listings glance rows. */
export const MARKETPLACE_DASHBOARD_ROWS = [
  { key: 'active', label: 'Active listings' },
  { key: 'new7d', label: 'New (7d)' },
  { key: 'pending', label: 'Pending' },
] as const

export type MarketplaceListingsKey = MarketplaceListingsStatKey

export type MarketplaceListingsStats = {
  byKey: Record<MarketplaceListingsKey, number | null>
}

/**
 * Real `sf_marketplace_listings` aggregates for `marketplace.listings`.
 * Module off or query failure → ok:false / unavailable (card keeps “—”, not zeros).
 */
export async function loadMarketplaceListingsStats(): Promise<
  DashboardStatsResult<MarketplaceListingsStats>
> {
  try {
    const { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } = await import(
      '@/core/settings'
    )
    const settings = await getSiteSettings()
    if (!isCatalogModuleEnabled(settings, MODULE_IDS.marketplace)) {
      return {
        ok: false,
        error: 'Marketplace module is disabled',
        status: 'unavailable',
      }
    }

    const { eq } = await import('drizzle-orm')
    const { db } = await import('@/core/db')
    const { sfMarketplaceCategories, sfMarketplaceListings } = await import('../schema')
    const { countMarketplaceListingsStats } = await import('./marketplace-listings-counts')

    const rows = await db
      .select({
        status: sfMarketplaceListings.status,
        expiresAt: sfMarketplaceListings.expiresAt,
        createdAt: sfMarketplaceListings.createdAt,
        categoryEnabled: sfMarketplaceCategories.enabled,
      })
      .from(sfMarketplaceListings)
      .leftJoin(
        sfMarketplaceCategories,
        eq(sfMarketplaceListings.categoryId, sfMarketplaceCategories.id),
      )

    const now = new Date()
    const counts = countMarketplaceListingsStats(
      rows.map((row) => ({
        status: row.status,
        categoryEnabled: row.categoryEnabled === true,
        expiresAt: row.expiresAt,
        createdAt: row.createdAt,
      })),
      now,
    )

    return {
      ok: true,
      data: {
        byKey: {
          active: counts.active,
          new7d: counts.new7d,
          pending: counts.pending,
        },
      },
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Marketplace dashboard query failed'
    console.error('[dashboard] marketplace.listings stats failed', error)
    return {
      ok: false,
      error: message,
      status: 'unavailable',
    }
  }
}
