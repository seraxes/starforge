import React from 'react'

import { adminDashboardWidgetLoaders } from '@/generated/module-registry.server'

import type { ResolvedDashboardWidget } from './types'

async function softLoadWidget(
  moduleId: string,
  id: string,
): Promise<React.ComponentType<Record<string, never>> | null> {
  const entry = adminDashboardWidgetLoaders.find(
    (row) => row.moduleId === moduleId && row.id === id,
  )
  if (!entry) return null
  try {
    const loaded = await entry.load()
    return loaded as React.ComponentType<Record<string, never>>
  } catch (error) {
    console.error(`[dashboard] widget load failed ${moduleId}/${id}`, error)
    return null
  }
}

function sizeClass(size: ResolvedDashboardWidget['size']): string {
  if (size === 'lg') return 'sf-dashboard-card sf-dashboard-card-lg'
  if (size === 'sm') return 'sf-dashboard-card sf-dashboard-card-sm'
  return 'sf-dashboard-card'
}

/** One contributed card — soft-fail so a broken pack cannot blank the page. */
export async function DashboardWidgetCard(props: {
  widget: ResolvedDashboardWidget
}) {
  const { widget } = props
  const Widget = await softLoadWidget(widget.moduleId, widget.id)

  if (!Widget) {
    return (
      <article className={sizeClass(widget.size)} data-widget={`${widget.moduleId}:${widget.id}`}>
        <header className="sf-dashboard-card-head">
          <h3>{widget.title}</h3>
        </header>
        <div className="sf-dashboard-card-body">
          <p className="sf-dashboard-soft-fail">—</p>
        </div>
      </article>
    )
  }

  return (
    <article className={sizeClass(widget.size)} data-widget={`${widget.moduleId}:${widget.id}`}>
      <header className="sf-dashboard-card-head">
        <h3>{widget.title}</h3>
      </header>
      <div className="sf-dashboard-card-body">
        <Widget />
      </div>
    </article>
  )
}

/** Grid of resolved widgets (Page Settings mosaic language). */
export function DashboardWidgetGrid(props: {
  widgets: ResolvedDashboardWidget[]
  children?: React.ReactNode
}) {
  const { widgets, children } = props
  if (widgets.length === 0 && !children) return null
  return (
    <div className="admin-settings-mosaic sf-dashboard-grid">
      {children}
      {widgets.map((widget) => (
        <DashboardWidgetCard key={`${widget.moduleId}:${widget.id}`} widget={widget} />
      ))}
    </div>
  )
}
