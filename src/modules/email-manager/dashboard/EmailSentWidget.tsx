import React from 'react'
import Link from 'next/link'

import { coreAdminPath } from '@/core/admin-paths'
import { DashboardSoftPlaceholder } from '@/core/dashboard/widgets/DashboardSoftPlaceholder'

import { EMAIL_DASHBOARD_TYPES, loadEmailSentStats } from './email-stats'

function dash(n: number | null | undefined): string {
  return n == null ? '—' : String(n)
}

/**
 * product:email-manager Dashboard card — count + type from `sf_email_sends`.
 * Same row chrome as the soft stub; no visual redesign.
 */
export async function EmailSentWidget() {
  const result = await loadEmailSentStats()

  if (!result.ok) {
    return (
      <DashboardSoftPlaceholder
        status={result.status === 'unavailable' ? 'unavailable' : 'soft-fail'}
        hint="Email volume by type will appear here when the send log is reachable."
        rows={EMAIL_DASHBOARD_TYPES.map((entry) => ({ label: entry.label, value: '—' }))}
        footerHref={coreAdminPath('/email')}
        footerLabel="Open Email Manager"
      />
    )
  }

  return (
    <div className="sf-dashboard-email" aria-label="Email sent">
      <dl className="sf-dashboard-placeholder-rows">
        {EMAIL_DASHBOARD_TYPES.map((entry) => (
          <div key={entry.key} className="sf-dashboard-placeholder-row">
            <dt>{entry.label}</dt>
            <dd>{dash(result.data.byType[entry.key])}</dd>
          </div>
        ))}
      </dl>
      <p className="sf-dashboard-card-foot">
        <Link href={coreAdminPath('/email')}>Open Email Manager</Link>
      </p>
    </div>
  )
}

export default EmailSentWidget
