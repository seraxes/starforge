import type { LayoutGridWidth } from './types'

/** Minimum width per particle in a shared row (%). */
export const LAYOUT_WIDTH_MIN = 5

/** Maximum width when another particle must keep at least LAYOUT_WIDTH_MIN (%). */
export const LAYOUT_WIDTH_MAX = 95

/** Full row width (%). */
export const LAYOUT_WIDTH_FULL = 100

/** @deprecated Kept for older imports — widths are percentages now. */
export const LAYOUT_GRID_COLUMNS = LAYOUT_WIDTH_FULL

/**
 * Clamp a slot width to an integer percent.
 * Default range 5–100 (single particle can be 100%).
 */
export function clampGridWidth(
  raw: unknown,
  fallback: LayoutGridWidth = LAYOUT_WIDTH_FULL,
  opts?: { min?: number; max?: number },
): LayoutGridWidth {
  const min = opts?.min ?? LAYOUT_WIDTH_MIN
  const max = opts?.max ?? LAYOUT_WIDTH_FULL
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

/** Width is already percent — return clamped percent. */
export function gridWidthPercent(width: LayoutGridWidth): number {
  return clampGridWidth(width)
}

/** Inline flex basis / max-width for a public/admin grid column. */
export function gridColStyle(width: LayoutGridWidth): {
  flex: string
  maxWidth: string
  width: string
} {
  const pct = `${gridWidthPercent(width)}%`
  return {
    flex: `0 0 ${pct}`,
    maxWidth: pct,
    width: pct,
  }
}

/** Sum of slot widths in a row. */
export function sumRowWidths(widths: LayoutGridWidth[]): number {
  return widths.reduce((sum, w) => sum + clampGridWidth(w), 0)
}

/**
 * Evenly redistribute percent widths across `count` slots so they sum to 100
 * (drop a second particle → 50% / 50%). Each slot ≥ 5%.
 */
export function evenColumnWidths(count: number): LayoutGridWidth[] {
  const n = Math.max(0, Math.floor(count))
  if (n === 0) return []
  if (n === 1) return [LAYOUT_WIDTH_FULL]
  if (n * LAYOUT_WIDTH_MIN > LAYOUT_WIDTH_FULL) {
    // Degenerate: give min to each until we run out (shouldn't happen for sane rows).
    return Array.from({ length: n }, () => LAYOUT_WIDTH_MIN)
  }
  const base = Math.floor(LAYOUT_WIDTH_FULL / n)
  let rem = LAYOUT_WIDTH_FULL - base * n
  const out: LayoutGridWidth[] = []
  for (let i = 0; i < n; i++) {
    const extra = rem > 0 ? 1 : 0
    if (rem > 0) rem -= 1
    out.push(clampGridWidth(base + extra, LAYOUT_WIDTH_MIN))
  }
  return out
}

/** Display helper: 50 → "50%". */
export function widthToPercentLabel(width: LayoutGridWidth): string {
  return `${gridWidthPercent(width)}%`
}

/**
 * Resize two adjacent slots in 1% steps.
 * Keeps their combined span; each stays ≥ 5% (so for a 100% pair → 5%–95%).
 */
export function resizeAdjacentPair(
  leftWidth: LayoutGridWidth,
  rightWidth: LayoutGridWidth,
  newLeftWidth: number,
): [LayoutGridWidth, LayoutGridWidth] {
  const pair = clampGridWidth(leftWidth) + clampGridWidth(rightWidth)
  const minLeft = LAYOUT_WIDTH_MIN
  const maxLeft = Math.max(minLeft, pair - LAYOUT_WIDTH_MIN)
  const left = Math.min(maxLeft, Math.max(minLeft, Math.round(newLeftWidth)))
  return [left, pair - left]
}

/**
 * Detect legacy 12-column widths (integers 1–12 summing to ≤12) and convert to %.
 * Already-percent rows (sum near 100 or any width > 12) are left alone aside from clamp.
 */
export function normalizeRowWidthsToPercent(widths: number[]): number[] {
  if (widths.length === 0) return []
  const numeric = widths.map((w) => (Number.isFinite(w) ? w : LAYOUT_WIDTH_FULL))
  const max = Math.max(...numeric)
  const sum = numeric.reduce((a, b) => a + b, 0)
  const looksLikeColumns = max <= 12 && sum <= 12 && numeric.every((w) => w >= 1)
  if (looksLikeColumns) {
    const converted = numeric.map((w) => Math.max(LAYOUT_WIDTH_MIN, Math.round((w / 12) * 100)))
    // Fix rounding so sum ≈ 100 when original summed to 12.
    if (sum === 12) {
      const diff = LAYOUT_WIDTH_FULL - converted.reduce((a, b) => a + b, 0)
      converted[converted.length - 1] = clampGridWidth(converted[converted.length - 1] + diff)
    }
    return converted
  }
  return numeric.map((w) => clampGridWidth(w))
}
