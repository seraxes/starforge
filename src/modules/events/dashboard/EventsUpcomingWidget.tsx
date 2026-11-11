import React from 'react'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { coreAdminPath } from '@/core/admin-paths'
import { DashboardBars } from '@/core/dashboard/charts/DashboardCharts'
import { DASH_SERIES } from '@/core/dashboard/charts/series'
import { DashboardSoftPlaceholder } from '@/core/dashboard/widgets/DashboardSoftPlaceholder'

import { EVENTS_DASHBOARD_ROWS, loadEventsUpcomingStats } from './events-stats'

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

  const colors = [DASH_SERIES[0], DASH_SERIES[2], DASH_SERIES[1]]

  return (
    <div className="sf-dashboard-events" aria-label={t('upcomingAriaLabel')}>
      <DashboardBars
        rows={EVENTS_DASHBOARD_ROWS.map((entry, index) => ({
          label: entry.label,
          value: result.data.byKey[entry.key] ?? 0,
          color: colors[index] ?? DASH_SERIES[0],
        }))}
      />
      <p className="sf-dashboard-card-foot">
        <Link href={coreAdminPath('/events')}>{t('openManager')}</Link>
      </p>
    </div>
  )
}

export default EventsUpcomingWidget
