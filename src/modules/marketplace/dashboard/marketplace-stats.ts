import 'server-only'

import type { DashboardStatsResult } from '@/core/dashboard'

/** Soft Marketplace listings glance rows. */
export const MARKETPLACE_DASHBOARD_ROWS = [
  { key: 'active', label: 'Active listings' },
  { key: 'new7d', label: 'New (7d)' },
  { key: 'pending', label: 'Pending' },
] as const

export type MarketplaceListingsKey = (typeof MARKETPLACE_DASHBOARD_ROWS)[number]['key']

export type MarketplaceListingsStats = {
  byKey: Record<MarketplaceListingsKey, number | null>
}

/**
 * Soft stub — Marketplace pack has no schema yet.
 * Unavailable → “—” / Coming soon, not fake zeros.
 */
export async function loadMarketplaceListingsStats(): Promise<
  DashboardStatsResult<MarketplaceListingsStats>
> {
  return {
    ok: false,
    error: 'Marketplace module is not shipped yet',
    status: 'unavailable',
  }
}
