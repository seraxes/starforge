import React from 'react'
import Link from 'next/link'

import { coreAdminPath } from '@/core/admin-paths'
import { DashboardSoftPlaceholder } from '@/core/dashboard/widgets/DashboardSoftPlaceholder'

import { PERFORMANCE_DASHBOARD_ROWS, loadPerformanceGlanceStats } from './performance-stats'

function dash(value: string | null | undefined): string {
  return value == null || value === '' ? '—' : value
}

const PERFORMANCE_TILES = [
  { key: 'dashboardRefresh', label: 'Refresh', tone: 'blue' },
  { key: 'formRateWindow', label: 'Rate window', tone: 'teal' },
  { key: 'formRateMax', label: 'Rate max', tone: 'orange' },
  { key: 'contentCache', label: 'Cache', tone: 'cyan' },
] as const

/**
 * Core Dashboard card — Performance glance (refresh + rate-limit knobs).
 * Compact metric tiles for the insight row under user metrics.
 */
export async function PerformanceGlanceWidget() {
  const result = await loadPerformanceGlanceStats()

  if (!result.ok) {
    return (
      <DashboardSoftPlaceholder
        status={result.status === 'unavailable' ? 'unavailable' : 'soft-fail'}
        hint="Dashboard refresh and form rate-limit knobs will appear here when Site Settings are reachable."
        rows={PERFORMANCE_DASHBOARD_ROWS.map((entry) => ({ label: entry.label, value: '—' }))}
        footerHref={coreAdminPath('/settings/performance')}
        footerLabel="Open Performance settings"
      />
    )
  }

  return (
    <div className="sf-dashboard-performance" aria-label="Performance glance">
      <ul className="sf-dash-mini-metrics">
        {PERFORMANCE_TILES.map((entry) => (
          <li key={entry.key} data-tone={entry.tone}>
            <span>{entry.label}</span>
            <strong>{dash(result.data.byKey[entry.key])}</strong>
          </li>
        ))}
      </ul>
      <p className="sf-dashboard-card-foot">
        <Link href={coreAdminPath('/settings/performance')}>Open Performance settings</Link>
      </p>
    </div>
  )
}

export default PerformanceGlanceWidget
