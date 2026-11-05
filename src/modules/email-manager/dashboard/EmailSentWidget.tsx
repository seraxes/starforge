import React from 'react'

import { coreAdminPath } from '@/core/admin-paths'
import { DashboardSoftPlaceholder } from '@/core/dashboard/widgets/DashboardSoftPlaceholder'

import { EMAIL_DASHBOARD_TYPES, loadEmailSentStats } from './email-stats'

/**
 * product:email-manager Dashboard stub — count + type summary.
 * Thin placeholder until send-log metrics land (D3).
 */
export async function EmailSentWidget() {
  const result = await loadEmailSentStats()

  const rows = EMAIL_DASHBOARD_TYPES.map((entry) => ({
    label: entry.label,
    value:
      result.ok && result.data.byType[entry.key] != null
        ? String(result.data.byType[entry.key])
        : '—',
  }))

  return (
    <DashboardSoftPlaceholder
      status="coming-soon"
      hint="Email volume by type will appear when the send log is available."
      rows={rows}
      footerHref={coreAdminPath('/email')}
      footerLabel="Open Email Manager"
    />
  )
}

export default EmailSentWidget
