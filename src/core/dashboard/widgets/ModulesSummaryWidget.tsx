import React from 'react'
import Link from 'next/link'

import { coreAdminPath } from '@/core/admin-paths'
import { DashboardSoftPlaceholder } from '@/core/dashboard/widgets/DashboardSoftPlaceholder'

import { loadModulesSummaryStats } from './modules-summary-stats'

/**
 * Core Dashboard card — enabled / allowlisted / disabled module counts.
 */
export async function ModulesSummaryWidget() {
  const result = await loadModulesSummaryStats()

  if (!result.ok) {
    return (
      <DashboardSoftPlaceholder
        status="soft-fail"
        hint="Enabled, allowlisted, and disabled counts appear here when the module catalog can load."
        rows={[
          { label: 'Enabled', value: '—' },
          { label: 'Allowlisted', value: '—' },
          { label: 'Disabled', value: '—' },
        ]}
        footerHref={coreAdminPath('/settings')}
        footerLabel="Open Modules"
      />
    )
  }

  const { enabled, allowlisted, disabled } = result.data

  return (
    <div className="sf-dashboard-modules" aria-label="Modules summary">
      <dl className="sf-dashboard-strip-grid">
        <div className="sf-dashboard-stat">
          <dt>Enabled</dt>
          <dd>{enabled}</dd>
        </div>
        <div className="sf-dashboard-stat">
          <dt>Allowlisted</dt>
          <dd>{allowlisted}</dd>
        </div>
        <div className="sf-dashboard-stat">
          <dt>Disabled</dt>
          <dd>{disabled}</dd>
        </div>
      </dl>
      <p className="sf-dashboard-card-foot">
        <Link href={coreAdminPath('/settings')}>Open Modules</Link>
      </p>
    </div>
  )
}

export default ModulesSummaryWidget
