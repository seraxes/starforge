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
