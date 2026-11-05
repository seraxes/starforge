import React from 'react'

import { coreAdminPath } from '@/core/admin-paths'
import { DashboardSoftPlaceholder } from '@/core/dashboard/widgets/DashboardSoftPlaceholder'

import {
  MARKETPLACE_DASHBOARD_ROWS,
  loadMarketplaceListingsStats,
} from './marketplace-stats'

/**
 * product:marketplace Dashboard card — listings glance (thin stub pack).
 */
export async function MarketplaceListingsWidget() {
  const result = await loadMarketplaceListingsStats()

  const rows = MARKETPLACE_DASHBOARD_ROWS.map((entry) => ({
    label: entry.label,
    value:
      result.ok && result.data.byKey[entry.key] != null
        ? String(result.data.byKey[entry.key])
        : '—',
  }))

  return (
    <DashboardSoftPlaceholder
      status="coming-soon"
      hint="Listing counts will appear when Marketplace ships."
      rows={rows}
      footerHref={coreAdminPath('/settings')}
      footerLabel="Modules settings"
    />
  )
}

export default MarketplaceListingsWidget
