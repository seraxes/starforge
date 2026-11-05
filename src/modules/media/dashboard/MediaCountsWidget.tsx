import React from 'react'
import Link from 'next/link'

import { coreAdminPath } from '@/core/admin-paths'
import { DashboardSoftPlaceholder } from '@/core/dashboard/widgets/DashboardSoftPlaceholder'

import { MEDIA_DASHBOARD_KINDS, loadMediaCountsStats } from './media-stats'

function dash(n: number | null | undefined): string {
  return n == null ? '—' : String(n)
}

/**
 * product:media Dashboard card — kinds + new windows (D2 Payload aggregates).
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

  return (
    <div className="sf-dashboard-media" aria-label="Media metrics">
      <dl className="sf-dashboard-placeholder-rows">
        {MEDIA_DASHBOARD_KINDS.map((kind) => (
          <div key={kind.key} className="sf-dashboard-placeholder-row">
            <dt>{kind.label}</dt>
            <dd>{dash(byKind[kind.key])}</dd>
          </div>
        ))}
        <div className="sf-dashboard-placeholder-row">
          <dt>New (24h)</dt>
          <dd>{dash(new24h)}</dd>
        </div>
        <div className="sf-dashboard-placeholder-row">
          <dt>New (1 week)</dt>
          <dd>{dash(new1w)}</dd>
        </div>
        <div className="sf-dashboard-placeholder-row">
          <dt>New (1 month)</dt>
          <dd>{dash(new1m)}</dd>
        </div>
      </dl>
      <p className="sf-dashboard-card-foot">
        <Link href={coreAdminPath('/media')}>Open Media library</Link>
      </p>
    </div>
  )
}

export default MediaCountsWidget
