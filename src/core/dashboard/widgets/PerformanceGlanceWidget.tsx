import React from 'react'
import Link from 'next/link'

import { coreAdminPath } from '@/core/admin-paths'
import { DashboardSoftPlaceholder } from '@/core/dashboard/widgets/DashboardSoftPlaceholder'

import { PERFORMANCE_DASHBOARD_ROWS, loadPerformanceGlanceStats } from './performance-stats'

function dash(value: string | null | undefined): string {
  return value == null || value === '' ? '—' : value
}

/**
 * Core Dashboard card — Performance glance (refresh + rate-limit knobs).
 * Same row chrome as the soft stub; no visual redesign.
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
      <dl className="sf-dashboard-placeholder-rows">
        {PERFORMANCE_DASHBOARD_ROWS.map((entry) => (
          <div key={entry.key} className="sf-dashboard-placeholder-row">
            <dt>{entry.label}</dt>
            <dd>{dash(result.data.byKey[entry.key])}</dd>
          </div>
        ))}
      </dl>
      <p className="sf-dashboard-card-foot">
        <Link href={coreAdminPath('/settings/performance')}>Open Performance settings</Link>
      </p>
    </div>
  )
}

export default PerformanceGlanceWidget
