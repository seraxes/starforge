import { monthSeriesBuckets } from '@/core/dashboard/charts/series'

import { PAYMENT_SOURCE_TYPES } from './types'

/** Paid and fulfilled lines count as sales. Open checkouts do not. */
export const SALES_ORDER_STATUSES = ['paid', 'fulfilled'] as const

/** Headline window, compared with the previous window of the same length. */
export const SALES_WINDOW_DAYS = 30

/** Sparkline length on the sales tiles. */
export const SALES_MONTH_COUNT = 6

export type PaymentSourceContract = {
  sourceModule: string
  sourceTypes: string[]
}

export type SalesModuleRef = {
  id: string
  label: string
  enabled: boolean
  href?: string | null
}

/** One source module in one currency, already summed for the two windows. */
export type SourceWindowTotals = {
  sourceModule: string
  currency: string
  grossMinor: number
  priorGrossMinor: number
  orders: number
  priorOrders: number
  units: number
  priorUnits: number
}

export type SalesMonthBucket = {
  key: string
  grossMinor: number
  orders: number
  units: number
}

export type SalesSourceRow = {
  sourceModule: string
  label: string
  href: string | null
  sourceTypes: string[]
  /** Null when the id is only on past orders and not in the installed catalog. */
  enabled: boolean | null
  currency: string
  grossMinor: number
  priorGrossMinor: number
  orders: number
  priorOrders: number
  units: number
  priorUnits: number
}

export type SalesMonthPoint = {
  key: string
  label: string
  grossMinor: number
  orders: number
  units: number
}

export type SalesBySourceSnapshot = {
  currency: string
  windowDays: number
  grossMinor: number
  priorGrossMinor: number
  orders: number
  priorOrders: number
  units: number
  priorUnits: number
  averageOrderMinor: number
  priorAverageOrderMinor: number
  months: SalesMonthPoint[]
  sources: SalesSourceRow[]
}

export type AssembleSalesBySourceInput = {
  now: Date
  currency: string
  windowDays?: number
  contracts: readonly PaymentSourceContract[]
  modules: readonly SalesModuleRef[]
  /** Source module ids that already appear on a paid or fulfilled order. */
  recordedSourceModules: readonly string[]
  totals: readonly SourceWindowTotals[]
  site: {
    grossMinor: number
    priorGrossMinor: number
    orders: number
    priorOrders: number
    units: number
    priorUnits: number
  }
  months: readonly SalesMonthBucket[]
}

function asCount(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.round(value))
}

function averageOrder(grossMinor: number, orders: number): number {
  if (orders <= 0) return 0
  return Math.round(grossMinor / orders)
}

/** `product:events` → `Events` when the catalog has no label. */
export function sourceModuleLabel(sourceModule: string, label?: string | null): string {
  const named = (label || '').trim()
  if (named) return named
  const tail = (sourceModule.split(':').pop() || sourceModule).trim()
  if (!tail) return sourceModule
  return tail
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

/**
 * Known Payments source contracts, one row per module id.
 * Shop and ads stay in the contract list even when that pack is not installed.
 */
export function paymentSourceContracts(
  types: Record<string, { sourceModule: string; sourceType: string }> = PAYMENT_SOURCE_TYPES,
): PaymentSourceContract[] {
  const byModule = new Map<string, Set<string>>()
  for (const entry of Object.values(types)) {
    const sourceModule = entry.sourceModule.trim()
    const sourceType = entry.sourceType.trim()
    if (!sourceModule || !sourceType) continue
    const typesForModule = byModule.get(sourceModule) ?? new Set<string>()
    typesForModule.add(sourceType)
    byModule.set(sourceModule, typesForModule)
  }
  return [...byModule.entries()]
    .map(([sourceModule, sourceTypes]) => ({
      sourceModule,
      sourceTypes: [...sourceTypes].sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => a.sourceModule.localeCompare(b.sourceModule))
}

function hasActivity(row: SourceWindowTotals): boolean {
  return (
    row.grossMinor > 0 ||
    row.priorGrossMinor > 0 ||
    row.orders > 0 ||
    row.priorOrders > 0 ||
    row.units > 0 ||
    row.priorUnits > 0
  )
}

/** Prefer the site currency when that bucket has sales; otherwise the busiest currency. */
export function chooseSourceBucket(
  rows: readonly SourceWindowTotals[],
  currency: string,
): SourceWindowTotals | null {
  if (rows.length === 0) return null
  const wanted = currency.trim().toUpperCase()
  const match = rows.find((row) => row.currency.trim().toUpperCase() === wanted) ?? null
  if (match && hasActivity(match)) return match
  const active = rows
    .filter(hasActivity)
    .slice()
    .sort((a, b) => b.grossMinor - a.grossMinor || a.currency.localeCompare(b.currency))
  if (active[0]) return active[0]
  return match ?? rows[0] ?? null
}

/**
 * Connected sources are installed modules named by a Payments contract,
 * plus any module id already stored on a paid or fulfilled line.
 * Uninstalled contracts (shop, ads on this build) stay off the card.
 */
export function assembleSalesBySource(input: AssembleSalesBySourceInput): SalesBySourceSnapshot {
  const currency = (input.currency || 'HUF').trim().toUpperCase() || 'HUF'
  const windowDays = input.windowDays && input.windowDays > 0 ? input.windowDays : SALES_WINDOW_DAYS
  const modules = new Map(input.modules.map((mod) => [mod.id, mod]))
  const contracts = new Map(input.contracts.map((contract) => [contract.sourceModule, contract]))

  const ids = new Set<string>()
  for (const contract of input.contracts) {
    if (modules.has(contract.sourceModule)) ids.add(contract.sourceModule)
  }
  for (const sourceModule of input.recordedSourceModules) {
    const id = sourceModule.trim()
    if (id) ids.add(id)
  }

  const totalsByModule = new Map<string, SourceWindowTotals[]>()
  for (const row of input.totals) {
    const id = row.sourceModule.trim()
    if (!id) continue
    const bucket: SourceWindowTotals = {
      sourceModule: id,
      currency: (row.currency || currency).trim().toUpperCase() || currency,
      grossMinor: asCount(row.grossMinor),
      priorGrossMinor: asCount(row.priorGrossMinor),
      orders: asCount(row.orders),
      priorOrders: asCount(row.priorOrders),
      units: asCount(row.units),
      priorUnits: asCount(row.priorUnits),
    }
    const list = totalsByModule.get(id) ?? []
    list.push(bucket)
    totalsByModule.set(id, list)
    ids.add(id)
  }

  const sources: SalesSourceRow[] = []
  for (const sourceModule of ids) {
    const mod = modules.get(sourceModule)
    const contract = contracts.get(sourceModule)
    if (!mod && !contract && !totalsByModule.has(sourceModule)) continue
    if (!mod && contract && !totalsByModule.has(sourceModule)) continue
    const chosen = chooseSourceBucket(totalsByModule.get(sourceModule) ?? [], currency)
    sources.push({
      sourceModule,
      label: sourceModuleLabel(sourceModule, mod?.label),
      href: mod?.href?.trim() || null,
      sourceTypes: contract?.sourceTypes ?? [],
      enabled: mod ? mod.enabled : null,
      currency: chosen?.currency ?? currency,
      grossMinor: chosen?.grossMinor ?? 0,
      priorGrossMinor: chosen?.priorGrossMinor ?? 0,
      orders: chosen?.orders ?? 0,
      priorOrders: chosen?.priorOrders ?? 0,
      units: chosen?.units ?? 0,
      priorUnits: chosen?.priorUnits ?? 0,
    })
  }

  sources.sort(
    (a, b) => b.grossMinor - a.grossMinor || a.sourceModule.localeCompare(b.sourceModule),
  )

  const grossMinor = asCount(input.site.grossMinor)
  const priorGrossMinor = asCount(input.site.priorGrossMinor)
  const orders = asCount(input.site.orders)
  const priorOrders = asCount(input.site.priorOrders)
  const units = asCount(input.site.units)
  const priorUnits = asCount(input.site.priorUnits)

  const monthCounts = new Map(input.months.map((month) => [month.key, month]))
  const months = monthSeriesBuckets(input.now, SALES_MONTH_COUNT).map((bucket) => {
    const hit = monthCounts.get(bucket.key)
    return {
      key: bucket.key,
      label: bucket.label,
      grossMinor: asCount(hit?.grossMinor ?? 0),
      orders: asCount(hit?.orders ?? 0),
      units: asCount(hit?.units ?? 0),
    }
  })

  return {
    currency,
    windowDays,
    grossMinor,
    priorGrossMinor,
    orders,
    priorOrders,
    units,
    priorUnits,
    averageOrderMinor: averageOrder(grossMinor, orders),
    priorAverageOrderMinor: averageOrder(priorGrossMinor, priorOrders),
    months,
    sources,
  }
}
