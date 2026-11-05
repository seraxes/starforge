import React from 'react'
import Link from 'next/link'

import { coreAdminPath } from '@/core/admin-paths'
import { DashboardSoftPlaceholder } from '@/core/dashboard/widgets/DashboardSoftPlaceholder'

import { SECURITY_DASHBOARD_ROWS, loadSecurityPostureStats } from './security-stats'

function dash(value: string | null | undefined): string {
  return value == null || value === '' ? '—' : value
}

/**
 * Core Dashboard card — Security posture glance (captcha / rate-limit / headers).
 * Same row chrome as the soft stub; no visual redesign.
 */
export async function SecurityPostureWidget() {
  const result = await loadSecurityPostureStats()

  if (!result.ok) {
    return (
      <DashboardSoftPlaceholder
        status={result.status === 'unavailable' ? 'unavailable' : 'soft-fail'}
        hint="Captcha, rate-limit, and header posture will appear here when Site Chrome is reachable."
        rows={SECURITY_DASHBOARD_ROWS.map((entry) => ({ label: entry.label, value: '—' }))}
        footerHref={coreAdminPath('/settings/security')}
        footerLabel="Open Security settings"
      />
    )
  }

  return (
    <div className="sf-dashboard-security" aria-label="Security posture">
      <dl className="sf-dashboard-placeholder-rows">
        {SECURITY_DASHBOARD_ROWS.map((entry) => (
          <div key={entry.key} className="sf-dashboard-placeholder-row">
            <dt>{entry.label}</dt>
            <dd>{dash(result.data.byKey[entry.key])}</dd>
          </div>
        ))}
      </dl>
      <p className="sf-dashboard-card-foot">
        <Link href={coreAdminPath('/settings/security')}>Open Security settings</Link>
      </p>
    </div>
  )
}

export default SecurityPostureWidget
