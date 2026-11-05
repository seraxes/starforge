import React from 'react'

import { coreAdminPath } from '@/core/admin-paths'
import { DashboardSoftPlaceholder } from '@/core/dashboard/widgets/DashboardSoftPlaceholder'

import { FORMS_DASHBOARD_ROWS, loadFormsSubmissionsStats } from './forms-stats'

/**
 * product:forms Dashboard card — submissions glance.
 * Soft stub until aggregate counts land (table already exists).
 */
export async function FormsSubmissionsWidget() {
  const result = await loadFormsSubmissionsStats()

  const rows = FORMS_DASHBOARD_ROWS.map((entry) => ({
    label: entry.label,
    value:
      result.ok && result.data.byKey[entry.key] != null
        ? String(result.data.byKey[entry.key])
        : '—',
  }))

  return (
    <DashboardSoftPlaceholder
      status="coming-soon"
      hint="Submission totals and recent windows will appear here."
      rows={rows}
      footerHref={coreAdminPath('/forms/submissions')}
      footerLabel="Open Form submissions"
    />
  )
}

export default FormsSubmissionsWidget
