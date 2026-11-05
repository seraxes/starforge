import React from 'react'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { coreAdminPath } from '@/core/admin-paths'
import { DashboardSoftPlaceholder } from '@/core/dashboard/widgets/DashboardSoftPlaceholder'

import { EVENTS_DASHBOARD_ROWS, loadEventsUpcomingStats } from './events-stats'

function dash(n: number | null | undefined): string {
  return n == null ? '—' : String(n)
}

/**
 * product:events Dashboard card — upcoming / this-week counts from `sf_events`.
 */
export async function EventsUpcomingWidget() {
  const [result, t] = await Promise.all([
    loadEventsUpcomingStats(),
    getTranslations('product:events'),
  ])

  if (!result.ok) {
    return (
      <DashboardSoftPlaceholder
        status={result.status === 'unavailable' ? 'unavailable' : 'soft-fail'}
        hint={t('upcomingHint')}
        rows={EVENTS_DASHBOARD_ROWS.map((entry) => ({ label: entry.label, value: '—' }))}
        footerHref={coreAdminPath('/events')}
        footerLabel={t('openManager')}
      />
    )
  }

  return (
    <div className="sf-dashboard-events" aria-label={t('upcomingAriaLabel')}>
      <dl className="sf-dashboard-placeholder-rows">
        {EVENTS_DASHBOARD_ROWS.map((entry) => (
          <div key={entry.key} className="sf-dashboard-placeholder-row">
            <dt>{entry.label}</dt>
            <dd>{dash(result.data.byKey[entry.key])}</dd>
          </div>
        ))}
      </dl>
      <p className="sf-dashboard-card-foot">
        <Link href={coreAdminPath('/events')}>{t('openManager')}</Link>
      </p>
    </div>
  )
}

export default EventsUpcomingWidget
