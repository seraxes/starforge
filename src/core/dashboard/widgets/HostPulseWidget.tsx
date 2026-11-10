import React from 'react'
import Link from 'next/link'

import { coreAdminPath } from '@/core/admin-paths'

import { loadHostPulseStats } from './host-pulse-stats'

/**
 * Core Dashboard strip — process uptime, memory, library bytes, database size.
 * Stored volume, not live traffic.
 */
export async function HostPulseWidget() {
  const result = await loadHostPulseStats()
  if (!result.ok) {
    return <p className="sf-dashboard-soft-fail">—</p>
  }

  const { uptimeLabel, nodeLabel, memoryLabel, libraryLabel, databaseLabel } = result.data

  return (
    <div className="sf-dashboard-strip" aria-label="Host pulse">
      <dl className="sf-dashboard-strip-grid">
        <div className="sf-dashboard-stat">
          <dt>Uptime</dt>
          <dd>
            {uptimeLabel}
            {nodeLabel ? <span className="sf-dashboard-stat-hint"> {nodeLabel}</span> : null}
          </dd>
        </div>
        <div className="sf-dashboard-stat" title="Resident memory of this Node process">
          <dt>Memory</dt>
          <dd>{memoryLabel}</dd>
        </div>
        <div className="sf-dashboard-stat" title="Sum of media file sizes stored in the library">
          <dt>Library</dt>
          <dd>{libraryLabel}</dd>
        </div>
        <div className="sf-dashboard-stat" title="Postgres size of the current database">
          <dt>Database</dt>
          <dd>{databaseLabel}</dd>
        </div>
      </dl>
      <p className="sf-dashboard-card-foot">
        <Link href={coreAdminPath('/site-chrome/environment')}>Open Environment</Link>
      </p>
    </div>
  )
}

export default HostPulseWidget
