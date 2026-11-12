import React from 'react'
import Link from 'next/link'

import { coreAdminPath } from '@/core/admin-paths'
import { formatMoneyMinor } from '@/core/payments'
import {
  DashboardDonut,
  DashboardSparkline,
} from '@/core/dashboard/charts/DashboardCharts'
import {
  DASH_SERIES,
  formatCount,
  formatSignedPercent,
  percentDelta,
} from '@/core/dashboard/charts/series'
import { DashboardSoftPlaceholder } from '@/core/dashboard/widgets/DashboardSoftPlaceholder'

import { loadSalesBySourceStats } from '../dashboard/sales-stats'
import type { SalesBySourceSnapshot, SalesSourceRow } from '../sales-by-source'

function seriesColor(index: number): string {
  return DASH_SERIES[index % DASH_SERIES.length] ?? DASH_SERIES[0]
}

function Delta(props: { pct: number | null; hint: string }) {
  if (props.pct == null) return null
  const tone = props.pct > 0 ? 'up' : props.pct < 0 ? 'down' : 'flat'
  return (
    <p className={`sf-dash-kpi-delta sf-dash-kpi-delta-${tone}`}>
      {formatSignedPercent(props.pct)} {props.hint}
    </p>
  )
}

function countLabel(count: number, singular: string, plural: string): string {
  return `${formatCount(count)} ${count === 1 ? singular : plural}`
}

function sharePct(grossMinor: number, totalMinor: number): number {
  if (totalMinor <= 0 || grossMinor <= 0) return 0
  return Math.max(0, Math.min(100, (grossMinor / totalMinor) * 100))
}

function shareLabel(grossMinor: number, totalMinor: number, sameCurrency: boolean): string {
  if (!sameCurrency) return '—'
  if (totalMinor <= 0) return '0%'
  const pct = Math.round((grossMinor / totalMinor) * 1000) / 10
  return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(1)}%`
}

function SalesBySourceBody(props: { snapshot: SalesBySourceSnapshot }) {
  const { snapshot } = props
  const hint = `vs prior ${snapshot.windowDays} days`
  const monthGross = snapshot.months.map((month) => month.grossMinor)
  const monthOrders = snapshot.months.map((month) => month.orders)
  const monthUnits = snapshot.months.map((month) => month.units)
  const monthAverage = snapshot.months.map((month) =>
    month.orders > 0 ? Math.round(month.grossMinor / month.orders) : 0,
  )
  const colored = snapshot.sources.map((row, index) => ({
    row,
    color: seriesColor(index),
  }))
  const shareTotal = colored.reduce((sum, item) => {
    if (item.row.currency !== snapshot.currency) return sum
    return sum + item.row.grossMinor
  }, 0)
  const donutRows = colored.filter((item) => item.row.currency === snapshot.currency)

  return (
    <div className="sf-pay-sales sf-dashboard" aria-label="Sales by source">
      <dl className="sf-dash-kpis">
        <div className="sf-dash-kpi" data-tone="blue">
          <dt>Gross sales</dt>
          <dd>{formatMoneyMinor(snapshot.grossMinor, snapshot.currency)}</dd>
          <div className="sf-dash-kpi-chart">
            <DashboardSparkline values={monthGross} title="Gross sales by month" />
          </div>
          <Delta pct={percentDelta(snapshot.grossMinor, snapshot.priorGrossMinor)} hint={hint} />
        </div>
        <div className="sf-dash-kpi" data-tone="teal">
          <dt>Orders</dt>
          <dd>{formatCount(snapshot.orders)}</dd>
          <div className="sf-dash-kpi-chart">
            <DashboardSparkline values={monthOrders} title="Orders by month" />
          </div>
          <Delta pct={percentDelta(snapshot.orders, snapshot.priorOrders)} hint={hint} />
        </div>
        <div className="sf-dash-kpi" data-tone="orange">
          <dt>Units</dt>
          <dd>{formatCount(snapshot.units)}</dd>
          <div className="sf-dash-kpi-chart">
            <DashboardSparkline values={monthUnits} title="Units by month" />
          </div>
          <Delta pct={percentDelta(snapshot.units, snapshot.priorUnits)} hint={hint} />
        </div>
        <div className="sf-dash-kpi" data-tone="cyan">
          <dt>Avg. order</dt>
          <dd>{formatMoneyMinor(snapshot.averageOrderMinor, snapshot.currency)}</dd>
          <div className="sf-dash-kpi-chart">
            <DashboardSparkline values={monthAverage} title="Average order by month" />
          </div>
          <Delta
            pct={percentDelta(snapshot.averageOrderMinor, snapshot.priorAverageOrderMinor)}
            hint={hint}
          />
        </div>
      </dl>

      <section className="sf-dash-chart" aria-label="Sales by connected module">
        <header className="sf-dash-chart-head">
          <div>
            <h3>By module</h3>
            <p className="sf-dash-chart-sub">
              {countLabel(snapshot.sources.length, 'connected module', 'connected modules')} · paid
              and fulfilled, last {snapshot.windowDays} days
            </p>
          </div>
          <div className="sf-dash-chart-tools">
            <Link href={coreAdminPath('/payments/orders')}>All orders</Link>
          </div>
        </header>

        <div className="sf-dash-split sf-pay-sales-split">
          <DashboardDonut
            values={donutRows.map((item) => item.row.grossMinor)}
            colors={donutRows.map((item) => item.color)}
            total={formatMoneyMinor(snapshot.grossMinor, snapshot.currency)}
            totalLabel="gross"
          />
          {colored.length === 0 ? (
            <p className="sf-dash-chart-sub">No payment modules are connected.</p>
          ) : (
            <ul className="sf-pay-sources">
              {colored.map((item) => (
                <SourceRow
                  key={item.row.sourceModule}
                  row={item.row}
                  color={item.color}
                  shareTotal={shareTotal}
                  siteCurrency={snapshot.currency}
                />
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}

function SourceRow(props: {
  row: SalesSourceRow
  color: string
  shareTotal: number
  siteCurrency: string
}) {
  const { row, color, shareTotal, siteCurrency } = props
  const sameCurrency = row.currency === siteCurrency
  const width = sameCurrency ? sharePct(row.grossMinor, shareTotal) : 0
  const money = formatMoneyMinor(row.grossMinor, row.currency)
  const name = row.href ? <Link href={row.href}>{row.label}</Link> : <span>{row.label}</span>

  return (
    <li className="sf-pay-source" aria-label={`${row.label} ${row.sourceModule}: ${money}`}>
      <span className="sf-dash-swatch" style={{ background: color }} />
      <div className="sf-pay-source-id-block">
        <p className="sf-pay-source-name">
          {name}
          {row.enabled == null ? null : (
            <span
              className={
                row.enabled
                  ? 'sf-dashboard-chip sf-dashboard-chip-ok'
                  : 'sf-dashboard-chip sf-dashboard-chip-warn'
              }
            >
              {row.enabled ? 'On' : 'Off'}
            </span>
          )}
        </p>
        <p className="sf-pay-source-id">
          {row.sourceModule}
          {row.sourceTypes.length > 0 ? ` · ${row.sourceTypes.join(', ')}` : ''}
        </p>
      </div>
      <span className="sf-dash-legend-track sf-pay-source-track" aria-hidden="true">
        <span style={{ width: `${width}%`, background: color }} />
      </span>
      <div className="sf-pay-source-money">
        <strong>{money}</strong>
        <span>
          {shareLabel(row.grossMinor, shareTotal, sameCurrency)} ·{' '}
          {countLabel(row.orders, 'order', 'orders')} · {countLabel(row.units, 'unit', 'units')}
        </span>
      </div>
    </li>
  )
}

/** Same sales-by-source body on Payments overview and the Dashboard. */
export async function SalesBySourceCard() {
  const result = await loadSalesBySourceStats()
  if (!result.ok) {
    return (
      <DashboardSoftPlaceholder
        status="unavailable"
        hint="Paid and fulfilled totals by source module will appear here when orders are reachable."
        footerHref={coreAdminPath('/payments/orders')}
        footerLabel="All orders"
      />
    )
  }
  return <SalesBySourceBody snapshot={result.data} />
}
