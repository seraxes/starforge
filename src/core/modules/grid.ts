import { LAYOUT_GRID_COLUMNS, type LayoutGridWidth } from './types'

/** Clamp a slot width into the 1–12 grid. */
export function clampGridWidth(raw: unknown, fallback: LayoutGridWidth = LAYOUT_GRID_COLUMNS): LayoutGridWidth {
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n)) return fallback
  return Math.min(LAYOUT_GRID_COLUMNS, Math.max(1, Math.round(n)))
}

/** Percent of the row for a column span (no Bootstrap). */
export function gridWidthPercent(width: LayoutGridWidth): number {
  return (clampGridWidth(width) / LAYOUT_GRID_COLUMNS) * 100
}

/** Inline flex basis / max-width for a public grid column. */
export function gridColStyle(width: LayoutGridWidth): { flex: string; maxWidth: string; width: string } {
  const pct = `${gridWidthPercent(width)}%`
  return {
    flex: `0 0 ${pct}`,
    maxWidth: pct,
    width: pct,
  }
}

/** Sum of slot widths in a row (for admin overflow warnings). */
export function sumRowWidths(widths: LayoutGridWidth[]): number {
  return widths.reduce((sum, w) => sum + clampGridWidth(w), 0)
}

/**
 * Evenly redistribute column widths across `count` slots so they sum to 12
 * (Gantry-like: drop a second particle beside the first → ~50% / 50%).
 */
export function evenColumnWidths(count: number): LayoutGridWidth[] {
  const n = Math.max(0, Math.floor(count))
  if (n === 0) return []
  if (n === 1) return [LAYOUT_GRID_COLUMNS]
  const base = Math.floor(LAYOUT_GRID_COLUMNS / n)
  let rem = LAYOUT_GRID_COLUMNS - base * n
  const out: LayoutGridWidth[] = []
  for (let i = 0; i < n; i++) {
    const extra = rem > 0 ? 1 : 0
    if (rem > 0) rem -= 1
    out.push(clampGridWidth(base + extra, 1))
  }
  return out
}

/** Display helper: 6 → "50%". */
export function widthToPercentLabel(width: LayoutGridWidth): string {
  const pct = Math.round(gridWidthPercent(width))
  return `${pct}%`
}

/**
 * Resize two adjacent slots: keep their combined span, clamp each to ≥1.
 * Returns the new [left, right] widths.
 */
export function resizeAdjacentPair(
  leftWidth: LayoutGridWidth,
  rightWidth: LayoutGridWidth,
  newLeftWidth: number,
): [LayoutGridWidth, LayoutGridWidth] {
  const pair = clampGridWidth(leftWidth) + clampGridWidth(rightWidth)
  const left = Math.min(pair - 1, Math.max(1, Math.round(newLeftWidth)))
  return [left, pair - left]
}
