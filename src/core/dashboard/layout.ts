import type { DashboardWidgetSize } from './types'

type InsightWidget = {
  id: string
  order: number
  size: DashboardWidgetSize | string
}

/**
 * Pull `sm` widgets into the compact row that sits under user metrics.
 * Callers pass widgets already sorted by order. When the user-metrics
 * card is present, that row replaces the old full-width chart slot.
 */
export function placeDashboardInsight<T extends InsightWidget>(
  widgets: readonly T[],
): { before: T[]; insight: T[]; after: T[] } {
  const insight = widgets.filter((widget) => widget.size === 'sm')
  const rest = widgets.filter((widget) => widget.size !== 'sm')
  if (insight.length === 0) {
    return { before: [...rest], insight: [], after: [] }
  }

  const heroAt = rest.findIndex((widget) => widget.id === 'users.strip')
  if (heroAt >= 0) {
    return {
      before: rest.slice(0, heroAt + 1),
      insight: [...insight],
      after: rest.slice(heroAt + 1),
    }
  }

  const pivot = Math.min(...insight.map((widget) => widget.order))
  const cut = rest.findIndex((widget) => widget.order > pivot)
  if (cut === -1) {
    return { before: [...rest], insight: [...insight], after: [] }
  }
  return {
    before: rest.slice(0, cut),
    insight: [...insight],
    after: rest.slice(cut),
  }
}
