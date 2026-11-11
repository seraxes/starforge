import React from 'react'
import Link from 'next/link'

import { coreAdminPath } from '@/core/admin-paths'
import { getSiteSettings } from '@/core/settings'

import {
  DashboardAreaChart,
  DashboardMeter,
  DashboardSparkline,
} from '../charts/DashboardCharts'
import {
  DASH_SERIES,
  formatCount,
  formatSignedPercent,
  percentDelta,
} from '../charts/series'
import { loadUsersStripStats, loadUserSignupSeries, type UserSignupSeries } from './users-stats'

function Delta(props: { pct: number | null; hint: string }) {
  if (props.pct == null) return null
  const tone = props.pct > 0 ? 'up' : props.pct < 0 ? 'down' : 'flat'
  return (
    <p className={`sf-dash-kpi-delta sf-dash-kpi-delta-${tone}`}>
      {formatSignedPercent(props.pct)} {props.hint}
    </p>
  )
}

/** Core Dashboard — colored user tiles plus a 12-month signup chart. */
export async function UsersStripWidget() {
  const settings = await getSiteSettings()
  const stats = await loadUsersStripStats({
    onlineWindowMin: settings.dashboardOnlineWindowMin,
  })

  let series: UserSignupSeries | null = null
  try {
    series = await loadUserSignupSeries()
  } catch (error) {
    console.error('[dashboard] user signup series failed', error)
  }

  const thisMonth = series?.months.at(-1)?.value ?? 0
  const prevMonth = series?.months.at(-2)?.value ?? 0
  const monthDelta = series ? percentDelta(thisMonth, prevMonth) : null
  const dayDelta = series ? percentDelta(stats.newlyRegistered10d, series.prior10d) : null
  const onlineShare =
    stats.totalUsers > 0 ? Math.round((stats.onlineNow / stats.totalUsers) * 1000) / 10 : 0
  const siteLabel =
    stats.siteOffline == null ? '—' : stats.siteOffline ? 'Offline' : 'Online'

  return (
    <div className="sf-dashboard-strip sf-dash-hero" aria-label="User metrics">
      <dl className="sf-dash-kpis">
        <div className="sf-dash-kpi" data-tone="blue">
          <dt>Total users</dt>
          <dd>{formatCount(stats.totalUsers)}</dd>
          <div className="sf-dash-kpi-chart">
            <DashboardSparkline
              values={series?.months.map((point) => point.value) ?? []}
              title="Monthly signups"
            />
          </div>
          <Delta pct={monthDelta} hint="vs last month" />
        </div>
        <div className="sf-dash-kpi" data-tone="teal">
          <dt>Online now</dt>
          <dd>{formatCount(stats.onlineNow)}</dd>
          <div className="sf-dash-kpi-chart">
            <DashboardMeter
              value={stats.onlineNow}
              max={stats.totalUsers}
              label={`${stats.onlineNow} of ${stats.totalUsers} accounts online`}
            />
          </div>
          <p className="sf-dash-kpi-delta">
            {onlineShare}% of accounts · {stats.onlineWindowMin}m window
          </p>
        </div>
        <div className="sf-dash-kpi" data-tone="orange">
          <dt>New (10 days)</dt>
          <dd>{formatCount(stats.newlyRegistered10d)}</dd>
          <div className="sf-dash-kpi-chart">
            <DashboardSparkline
              values={series?.recentDays.map((point) => point.value) ?? []}
              title="Signups over the last 10 days"
            />
          </div>
          <Delta pct={dayDelta} hint="vs prior 10 days" />
        </div>
        <div className="sf-dash-kpi" data-tone="cyan">
          <dt>Site</dt>
          <dd>{siteLabel}</dd>
          <div className="sf-dash-kpi-chart sf-dash-kpi-status">
            <span
              className={`sf-dash-status-orb${stats.siteOffline ? ' is-off' : ''}`}
              aria-hidden="true"
            />
          </div>
          <p className="sf-dash-kpi-delta">
            {stats.siteOffline == null ? 'Chrome status unavailable' : 'From Site Chrome'}
          </p>
        </div>
      </dl>

      {series ? (
        <section className="sf-dash-chart" aria-label="Registrations">
          <header className="sf-dash-chart-head">
            <div>
              <h3>Registrations</h3>
              <p className="sf-dash-chart-sub">New accounts, last 12 months</p>
            </div>
            <div className="sf-dash-chart-tools">
              <p className="sf-dash-legend">
                <i style={{ background: DASH_SERIES[0] }} /> Signups
              </p>
              <Link href={coreAdminPath('/users')}>Open Users</Link>
            </div>
          </header>
          <DashboardAreaChart
            points={series.months}
            color={DASH_SERIES[0]}
            label={`Monthly signups, latest ${thisMonth}`}
          />
        </section>
      ) : (
        <p className="sf-dashboard-card-foot">
          <Link href={coreAdminPath('/users')}>Open Users</Link>
        </p>
      )}
    </div>
  )
}

export default UsersStripWidget
