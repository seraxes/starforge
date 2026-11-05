import React from 'react'

import { coreAdminPath } from '@/core/admin-paths'
import { DashboardSoftPlaceholder } from '@/core/dashboard/widgets/DashboardSoftPlaceholder'

import { EVENTS_DASHBOARD_ROWS, loadEventsUpcomingStats } from './events-stats'

/**
 * product:events Dashboard card — upcoming glance (thin stub pack).
 */
export async function EventsUpcomingWidget() {
  const result = await loadEventsUpcomingStats()

  const rows = EVENTS_DASHBOARD_ROWS.map((entry) => ({
    label: entry.label,
    value:
      result.ok && result.data.byKey[entry.key] != null
        ? String(result.data.byKey[entry.key])
        : '—',
  }))

  return (
    <DashboardSoftPlaceholder
      status="coming-soon"
      hint="Upcoming events and registrations will appear when Events ships."
      rows={rows}
      footerHref={coreAdminPath('/settings')}
      footerLabel="Modules settings"
    />
  )
}

export default EventsUpcomingWidget
