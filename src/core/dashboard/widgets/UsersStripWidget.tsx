import React from 'react'
import Link from 'next/link'

import { coreAdminPath } from '@/core/admin-paths'
import { getSiteSettings } from '@/core/settings'

import { loadUsersStripStats } from './users-stats'

/** Core Dashboard — users strip (total · online · new 10d). */
export async function UsersStripWidget() {
  const settings = await getSiteSettings()
  const stats = await loadUsersStripStats({
    onlineWindowMin: settings.dashboardOnlineWindowMin,
  })

  return (
    <div className="sf-dashboard-strip" aria-label="User metrics">
      <dl className="sf-dashboard-strip-grid">
        <div className="sf-dashboard-stat">
          <dt>Total users</dt>
          <dd>{stats.totalUsers}</dd>
        </div>
        <div className="sf-dashboard-stat">
          <dt>Online now</dt>
          <dd>
            {stats.onlineNow}
            <span className="sf-dashboard-stat-hint">
              {' '}
              ({stats.onlineWindowMin}m window)
            </span>
          </dd>
        </div>
        <div className="sf-dashboard-stat">
          <dt>New (10 days)</dt>
          <dd>{stats.newlyRegistered10d}</dd>
        </div>
        {stats.siteOffline != null ? (
          <div className="sf-dashboard-stat">
            <dt>Site</dt>
            <dd>
              {stats.siteOffline ? (
                <span className="sf-dashboard-chip sf-dashboard-chip-warn">Offline</span>
              ) : (
                <span className="sf-dashboard-chip">Online</span>
              )}
            </dd>
          </div>
        ) : null}
      </dl>
      <p className="sf-dashboard-card-foot">
        <Link href={coreAdminPath('/users')}>Open Users</Link>
      </p>
    </div>
  )
}

export default UsersStripWidget
