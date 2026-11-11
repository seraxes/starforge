import React from 'react'
import Link from 'next/link'

import { coreAdminPath } from '@/core/admin-paths'
import { DashboardBars } from '@/core/dashboard/charts/DashboardCharts'
import { DASH_SERIES } from '@/core/dashboard/charts/series'
import { DashboardSoftPlaceholder } from '@/core/dashboard/widgets/DashboardSoftPlaceholder'

import { FORMS_DASHBOARD_ROWS, loadFormsSubmissionsStats } from './forms-stats'

function asCount(value: string | number | null | undefined): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

/**
 * product:forms Dashboard card — submission windows as bars.
 */
export async function FormsSubmissionsWidget() {
  const result = await loadFormsSubmissionsStats()

  if (!result.ok) {
    return (
      <DashboardSoftPlaceholder
        status={result.status === 'unavailable' ? 'unavailable' : 'soft-fail'}
        hint="Submission totals and recent windows will appear here when the forms store is reachable."
        rows={FORMS_DASHBOARD_ROWS.map((entry) => ({ label: entry.label, value: '—' }))}
        footerHref={coreAdminPath('/forms/submissions')}
        footerLabel="Open Form submissions"
      />
    )
  }

  const byKey = result.data.byKey
  const barKeys = ['total', 'new24h', 'new7d'] as const
  const colors = [DASH_SERIES[0], DASH_SERIES[1], DASH_SERIES[2]]

  return (
    <div className="sf-dashboard-forms" aria-label="Forms submissions">
      <DashboardBars
        rows={barKeys.map((key, index) => {
          const entry = FORMS_DASHBOARD_ROWS.find((row) => row.key === key)
          return {
            label: entry?.label ?? key,
            value: asCount(byKey[key]),
            color: colors[index] ?? DASH_SERIES[0],
          }
        })}
      />
      <p className="sf-dash-latest-line">Latest {byKey.latest == null || byKey.latest === '' ? '—' : String(byKey.latest)}</p>
      <p className="sf-dashboard-card-foot">
        <Link href={coreAdminPath('/forms/submissions')}>Open Form submissions</Link>
      </p>
    </div>
  )
}

export default FormsSubmissionsWidget
