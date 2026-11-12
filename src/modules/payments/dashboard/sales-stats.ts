import 'server-only'

import { and, eq, inArray, sql } from 'drizzle-orm'

import type { DashboardStatsResult } from '@/core/dashboard'
import { monthSeriesBuckets, utcMonthStart } from '@/core/dashboard/charts/series'
import { db } from '@/core/db'
import { getSiteSettings, isCatalogModuleEnabled, listInstalledModuleCatalog } from '@/core/settings'

import { sfPayOrderLines, sfPayOrders } from '../schema'
import {
  SALES_MONTH_COUNT,
  SALES_ORDER_STATUSES,
  SALES_WINDOW_DAYS,
  assembleSalesBySource,
  paymentSourceContracts,
  type SalesBySourceSnapshot,
  type SalesModuleRef,
  type SalesMonthBucket,
  type SourceWindowTotals,
} from '../sales-by-source'
import { getPaymentsSettings } from '../store'

export type { SalesBySourceSnapshot } from '../sales-by-source'

const DAY_MS = 24 * 60 * 60_000

function asCount(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0
}

function moduleAdminHref(
  views: readonly { key: string; href: string }[] | undefined,
): string | null {
  if (!views?.length) return null
  const adminKeyed = views.find((view) => view.key === 'admin' && view.href.startsWith('/admin'))
  if (adminKeyed) return adminKeyed.href
  const anyAdmin = views.find((view) => view.href.startsWith('/admin'))
  return anyAdmin?.href ?? null
}

/**
 * Gross sales by source module for the Payments overview and the Dashboard card.
 * Connected modules are installed Payments contracts, plus any source id already
 * on a paid or fulfilled order. Soft-fails when the orders tables are unreachable.
 */
export async function loadSalesBySourceStats(
  now = new Date(),
): Promise<DashboardStatsResult<SalesBySourceSnapshot>> {
  try {
    const [settings, paySettings] = await Promise.all([getSiteSettings(), getPaymentsSettings()])
    const currency = (paySettings.currency || 'HUF').trim().toUpperCase() || 'HUF'
    const windowStart = new Date(now.getTime() - SALES_WINDOW_DAYS * DAY_MS)
    const priorStart = new Date(windowStart.getTime() - SALES_WINDOW_DAYS * DAY_MS)
    const monthBuckets = monthSeriesBuckets(now, SALES_MONTH_COUNT)
    const monthStart = utcMonthStart(monthBuckets[0]?.key ?? '')
    const soldAt = sql`coalesce(${sfPayOrders.paidAt}, ${sfPayOrders.createdAt})`
    const paid = inArray(sfPayOrders.status, [...SALES_ORDER_STATUSES])

    const inWindow = sql`${soldAt} >= ${windowStart} and ${soldAt} <= ${now}`
    const inPrior = sql`${soldAt} >= ${priorStart} and ${soldAt} < ${windowStart}`
    const monthKey = sql<string>`to_char(date_trunc('month', ${soldAt} at time zone 'utc'), 'YYYY-MM')`
    const siteCurrency = sql`upper(${sfPayOrders.currency}) = ${currency}`

    const sourceRows = await db
      .select({
        sourceModule: sfPayOrderLines.sourceModule,
        currency: sfPayOrders.currency,
        grossMinor: sql<number>`coalesce(sum(${sfPayOrderLines.lineGrossMinor}) filter (where ${inWindow}), 0)`,
        priorGrossMinor: sql<number>`coalesce(sum(${sfPayOrderLines.lineGrossMinor}) filter (where ${inPrior}), 0)`,
        units: sql<number>`coalesce(sum(${sfPayOrderLines.qty}) filter (where ${inWindow}), 0)`,
        priorUnits: sql<number>`coalesce(sum(${sfPayOrderLines.qty}) filter (where ${inPrior}), 0)`,
        orders: sql<number>`count(distinct ${sfPayOrders.id}) filter (where ${inWindow})`,
        priorOrders: sql<number>`count(distinct ${sfPayOrders.id}) filter (where ${inPrior})`,
      })
      .from(sfPayOrderLines)
      .innerJoin(sfPayOrders, eq(sfPayOrderLines.orderId, sfPayOrders.id))
      .where(paid)
      .groupBy(sfPayOrderLines.sourceModule, sfPayOrders.currency)

    const [site] = await db
      .select({
        grossMinor: sql<number>`coalesce(sum(${sfPayOrderLines.lineGrossMinor}) filter (where ${inWindow}), 0)`,
        priorGrossMinor: sql<number>`coalesce(sum(${sfPayOrderLines.lineGrossMinor}) filter (where ${inPrior}), 0)`,
        units: sql<number>`coalesce(sum(${sfPayOrderLines.qty}) filter (where ${inWindow}), 0)`,
        priorUnits: sql<number>`coalesce(sum(${sfPayOrderLines.qty}) filter (where ${inPrior}), 0)`,
        orders: sql<number>`count(distinct ${sfPayOrders.id}) filter (where ${inWindow})`,
        priorOrders: sql<number>`count(distinct ${sfPayOrders.id}) filter (where ${inPrior})`,
      })
      .from(sfPayOrderLines)
      .innerJoin(sfPayOrders, eq(sfPayOrderLines.orderId, sfPayOrders.id))
      .where(and(paid, siteCurrency))

    const monthRows = await db
      .select({
        key: monthKey,
        grossMinor: sql<number>`coalesce(sum(${sfPayOrderLines.lineGrossMinor}), 0)`,
        orders: sql<number>`count(distinct ${sfPayOrders.id})`,
        units: sql<number>`coalesce(sum(${sfPayOrderLines.qty}), 0)`,
      })
      .from(sfPayOrderLines)
      .innerJoin(sfPayOrders, eq(sfPayOrderLines.orderId, sfPayOrders.id))
      .where(and(paid, siteCurrency, sql`${soldAt} >= ${monthStart} and ${soldAt} <= ${now}`))
      .groupBy(monthKey)

    const modules: SalesModuleRef[] = listInstalledModuleCatalog().map((item) => ({
      id: item.id,
      label: item.label,
      enabled: isCatalogModuleEnabled(settings, item.id),
      href: moduleAdminHref(item.navViews),
    }))

    const totals: SourceWindowTotals[] = sourceRows.map((row) => ({
      sourceModule: row.sourceModule,
      currency: row.currency || currency,
      grossMinor: asCount(row.grossMinor),
      priorGrossMinor: asCount(row.priorGrossMinor),
      orders: asCount(row.orders),
      units: asCount(row.units),
      priorOrders: asCount(row.priorOrders),
      priorUnits: asCount(row.priorUnits),
    }))

    const months: SalesMonthBucket[] = monthRows.map((row) => ({
      key: String(row.key || ''),
      grossMinor: asCount(row.grossMinor),
      orders: asCount(row.orders),
      units: asCount(row.units),
    }))

    return {
      ok: true,
      data: assembleSalesBySource({
        now,
        currency,
        contracts: paymentSourceContracts(),
        modules,
        recordedSourceModules: totals.map((row) => row.sourceModule),
        totals,
        site: {
          grossMinor: asCount(site?.grossMinor),
          priorGrossMinor: asCount(site?.priorGrossMinor),
          orders: asCount(site?.orders),
          priorOrders: asCount(site?.priorOrders),
          units: asCount(site?.units),
          priorUnits: asCount(site?.priorUnits),
        },
        months,
      }),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sales by source query failed'
    console.error('[payments] sales by source failed', error)
    return { ok: false, error: message, status: 'error' }
  }
}
