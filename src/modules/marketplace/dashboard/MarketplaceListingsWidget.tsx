import React from 'react'
import Link from 'next/link'

import { coreAdminPath } from '@/core/admin-paths'
import { DashboardBars } from '@/core/dashboard/charts/DashboardCharts'
import { DASH_SERIES } from '@/core/dashboard/charts/series'
import { DashboardSoftPlaceholder } from '@/core/dashboard/widgets/DashboardSoftPlaceholder'

import { marketplaceListingsByKeyFromResult } from './marketplace-listings-counts'
import {
  MARKETPLACE_DASHBOARD_ROWS,
  loadMarketplaceListingsStats,
} from './marketplace-stats'

/**
 * product:marketplace Dashboard card — active / new-7d / pending listing counts.
 */
export async function MarketplaceListingsWidget() {
  const result = await loadMarketplaceListingsStats()
  const byKey = marketplaceListingsByKeyFromResult(result)

  if (!result.ok) {
    return (
      <DashboardSoftPlaceholder
        status={result.status === 'unavailable' ? 'unavailable' : 'soft-fail'}
        hint="Listing counts will appear when Marketplace stats are reachable."
        rows={MARKETPLACE_DASHBOARD_ROWS.map((entry) => ({
          label: entry.label,
          value: '—',
        }))}
        footerHref={coreAdminPath('/marketplace/listings')}
        footerLabel="Open Marketplace listings"
      />
    )
  }

  const colors = [DASH_SERIES[0], DASH_SERIES[2], DASH_SERIES[1]]

  return (
    <div className="sf-dashboard-marketplace" aria-label="Marketplace listings">
      <DashboardBars
        rows={MARKETPLACE_DASHBOARD_ROWS.map((entry, index) => ({
          label: entry.label,
          value: byKey[entry.key] ?? 0,
          color: colors[index] ?? DASH_SERIES[0],
        }))}
      />
      <p className="sf-dashboard-card-foot">
        <Link href={coreAdminPath('/marketplace/listings')}>Open Marketplace listings</Link>
      </p>
    </div>
  )
}

export default MarketplaceListingsWidget
