import React from 'react'

import { coreAdminPath } from '@/core/admin-paths'
import { DashboardSoftPlaceholder } from '@/core/dashboard/widgets/DashboardSoftPlaceholder'

import { PERFORMANCE_DASHBOARD_ROWS, loadPerformanceGlanceStats } from './performance-stats'

/**
 * Core Dashboard card — Performance glance (refresh + rate-limit knobs).
 * Soft stub until Settings → Performance values are mirrored (no fake numbers).
 */
export async function PerformanceGlanceWidget() {
  const result = await loadPerformanceGlanceStats()

  const rows = PERFORMANCE_DASHBOARD_ROWS.map((entry) => ({
    label: entry.label,
    value:
      result.ok && result.data.byKey[entry.key] != null
        ? String(result.data.byKey[entry.key])
        : '—',
  }))

  return (
    <DashboardSoftPlaceholder
      status="coming-soon"
      hint="Dashboard refresh and form rate-limit knobs will appear here."
      rows={rows}
      footerHref={coreAdminPath('/settings/performance')}
      footerLabel="Open Performance settings"
    />
  )
}

export default PerformanceGlanceWidget
