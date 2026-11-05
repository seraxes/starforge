import React from 'react'
import Link from 'next/link'

import { coreAdminPath } from '@/core/admin-paths'
import { DashboardSoftPlaceholder } from '@/core/dashboard/widgets/DashboardSoftPlaceholder'

import { FORMS_DASHBOARD_ROWS, loadFormsSubmissionsStats } from './forms-stats'

function dash(value: string | number | null | undefined): string {
  return value == null || value === '' ? '—' : String(value)
}

/**
 * product:forms Dashboard card — submissions glance (real `sf_form_submissions`).
 * Same row chrome as the soft stub; no visual redesign.
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

  return (
    <div className="sf-dashboard-forms" aria-label="Forms submissions">
      <dl className="sf-dashboard-placeholder-rows">
        {FORMS_DASHBOARD_ROWS.map((entry) => (
          <div key={entry.key} className="sf-dashboard-placeholder-row">
            <dt>{entry.label}</dt>
            <dd>{dash(result.data.byKey[entry.key])}</dd>
          </div>
        ))}
      </dl>
      <p className="sf-dashboard-card-foot">
        <Link href={coreAdminPath('/forms/submissions')}>Open Form submissions</Link>
      </p>
    </div>
  )
}

export default FormsSubmissionsWidget
