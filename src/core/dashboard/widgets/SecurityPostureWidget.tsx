import React from 'react'

import { coreAdminPath } from '@/core/admin-paths'
import { DashboardSoftPlaceholder } from '@/core/dashboard/widgets/DashboardSoftPlaceholder'

import { SECURITY_DASHBOARD_ROWS, loadSecurityPostureStats } from './security-stats'

/**
 * Core Dashboard card — Security posture glance (captcha / rate-limit / headers).
 * Soft stub until Settings → Security + headers resolve into readable chips.
 */
export async function SecurityPostureWidget() {
  const result = await loadSecurityPostureStats()

  const rows = SECURITY_DASHBOARD_ROWS.map((entry) => ({
    label: entry.label,
    value:
      result.ok && result.data.byKey[entry.key] != null
        ? String(result.data.byKey[entry.key])
        : '—',
  }))

  return (
    <DashboardSoftPlaceholder
      status="coming-soon"
      hint="Captcha, rate-limit, and header posture will appear here."
      rows={rows}
      footerHref={coreAdminPath('/settings/security')}
      footerLabel="Open Security settings"
    />
  )
}

export default SecurityPostureWidget
