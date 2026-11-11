import React from 'react'
import Link from 'next/link'

import { coreAdminPath } from '@/core/admin-paths'
import { DashboardDonut, DashboardLegend } from '@/core/dashboard/charts/DashboardCharts'
import { DASH_SERIES, formatCount } from '@/core/dashboard/charts/series'
import { DashboardSoftPlaceholder } from '@/core/dashboard/widgets/DashboardSoftPlaceholder'

import { MEDIA_DASHBOARD_KINDS, loadMediaCountsStats } from './media-stats'

function dash(n: number | null | undefined): string {
  return n == null ? '—' : formatCount(n)
}

/**
 * product:media Dashboard card — kind donut plus recent upload windows.
 */
export async function MediaCountsWidget() {
  const result = await loadMediaCountsStats()

  if (!result.ok) {
    return (
      <DashboardSoftPlaceholder
        status={result.status === 'unavailable' ? 'unavailable' : 'soft-fail'}
        hint="Media counts by kind and recent uploads will appear here when the library is reachable."
        rows={[
          ...MEDIA_DASHBOARD_KINDS.map((kind) => ({ label: kind.label, value: '—' })),
          { label: 'New (24h)', value: '—' },
          { label: 'New (1 week)', value: '—' },
          { label: 'New (1 month)', value: '—' },
        ]}
        footerHref={coreAdminPath('/media')}
        footerLabel="Open Media library"
      />
    )
  }

  const { byKind, new24h, new1w, new1m } = result.data
  const rows = MEDIA_DASHBOARD_KINDS.map((kind, index) => ({
    label: kind.label,
    value: byKind[kind.key] ?? 0,
    color: DASH_SERIES[index % DASH_SERIES.length] ?? DASH_SERIES[0],
  }))
  const total = rows.reduce((sum, row) => sum + row.value, 0)

  return (
    <div className="sf-dashboard-media" aria-label="Media metrics">
      <div className="sf-dash-split">
        <DashboardDonut
          values={rows.map((row) => row.value)}
          colors={rows.map((row) => row.color)}
          total={formatCount(total)}
          totalLabel="files"
        />
        <DashboardLegend rows={rows} />
      </div>
      <ul className="sf-dash-windows">
        <li>
          <span>24h</span>
          <strong>{dash(new24h)}</strong>
        </li>
        <li>
          <span>1 week</span>
          <strong>{dash(new1w)}</strong>
        </li>
        <li>
          <span>1 month</span>
          <strong>{dash(new1m)}</strong>
        </li>
      </ul>
      <p className="sf-dashboard-card-foot">
        <Link href={coreAdminPath('/media')}>Open Media library</Link>
      </p>
    </div>
  )
}

export default MediaCountsWidget
