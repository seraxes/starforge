/** Dashboard chart series — Starforge blue / orange, plus the reference stat hues. */
export const DASH_SERIES = ['#3498db', '#2fbfa0', '#ef9550', '#4eb6e0', '#8eb4d4'] as const

export type SeriesPoint = {
  key: string
  label: string
  value: number
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function formatCount(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}

/** Signed percent for KPI deltas. `null` when there is no prior window to compare. */
export function percentDelta(current: number, previous: number): number | null {
  if (previous <= 0) return null
  return Math.round(((current - previous) / previous) * 1000) / 10
}

export function formatSignedPercent(pct: number): string {
  const rounded = Math.round(pct * 10) / 10
  const body = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
  return rounded > 0 ? `+${body}%` : `${body}%`
}

export function monthSeriesBuckets(now: Date, count = 12): SeriesPoint[] {
  const points: SeriesPoint[] = []
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth()
  for (let i = count - 1; i >= 0; i -= 1) {
    const date = new Date(Date.UTC(year, month - i, 1))
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
    points.push({
      key,
      label: MONTH_LABELS[date.getUTCMonth()] ?? '',
      value: 0,
    })
  }
  return points
}

export function daySeriesBuckets(now: Date, count = 10): SeriesPoint[] {
  const points: SeriesPoint[] = []
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  for (let i = count - 1; i >= 0; i -= 1) {
    const date = new Date(start - i * 24 * 60 * 60_000)
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
    points.push({
      key,
      label: MONTH_LABELS[date.getUTCMonth()] ?? '',
      value: 0,
    })
  }
  return points
}

export function utcMonthStart(key: string): Date {
  const [year, month] = key.split('-').map((part) => Number(part))
  return new Date(Date.UTC(year || 1970, (month || 1) - 1, 1))
}

export function utcDayStart(key: string): Date {
  const [year, month, day] = key.split('-').map((part) => Number(part))
  return new Date(Date.UTC(year || 1970, (month || 1) - 1, day || 1))
}

export function applyBucketCounts(
  buckets: readonly SeriesPoint[],
  rows: readonly { key: string; value: number }[],
): SeriesPoint[] {
  const counts = new Map(rows.map((row) => [row.key, row.value]))
  return buckets.map((bucket) => ({
    ...bucket,
    value: counts.get(bucket.key) ?? 0,
  }))
}

export type PlotPoint = { x: number; y: number }

export function plotPoints(
  values: readonly number[],
  width: number,
  height: number,
  pad = 2,
): PlotPoint[] {
  const safe = values.map((value) => (Number.isFinite(value) ? Math.max(0, value) : 0))
  const max = Math.max(1, ...safe, 0)
  const count = Math.max(safe.length, 1)
  const innerW = Math.max(0, width - pad * 2)
  const innerH = Math.max(0, height - pad * 2)
  return safe.map((value, index) => {
    const x = count === 1 ? width / 2 : pad + (innerW * index) / (count - 1)
    const y = pad + innerH - (value / max) * innerH
    return { x, y }
  })
}

function roundCoord(value: number): string {
  return (Math.round(value * 10) / 10).toFixed(1)
}

export function linePath(points: readonly PlotPoint[]): string {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${roundCoord(point.x)} ${roundCoord(point.y)}`)
    .join(' ')
}

export function areaPath(points: readonly PlotPoint[], baselineY: number): string {
  if (points.length === 0) return ''
  const first = points[0]
  const last = points[points.length - 1]
  if (!first || !last) return ''
  return `${linePath(points)} L${roundCoord(last.x)} ${roundCoord(baselineY)} L${roundCoord(first.x)} ${roundCoord(baselineY)} Z`
}

export type DonutSlice = {
  /** Drawn portion of the circle (gap already removed). */
  frac: number
  /** Start position, 0–1, before the gap. */
  offset: number
}

/** Circle fractions. A small gap keeps neighboring hues from bleeding together. */
export function donutSlices(values: readonly number[], gap = 0.012): DonutSlice[] {
  const safe = values.map((value) => (Number.isFinite(value) ? Math.max(0, value) : 0))
  const total = safe.reduce((sum, value) => sum + value, 0)
  if (total <= 0) return []
  let cursor = 0
  return safe.map((value) => {
    const raw = value / total
    const slice = {
      frac: raw > gap ? raw - gap : raw,
      offset: cursor,
    }
    cursor += raw
    return slice
  })
}
