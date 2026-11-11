import React from 'react'

import { adminDashboardWidgetLoaders } from '@/generated/module-registry.server'

import type { ResolvedDashboardWidget } from './types'
import { DashboardSoftPlaceholder } from './widgets/DashboardSoftPlaceholder'

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

/** Page Settings mosaic language — wide tiles span both columns. */
function panelClass(widget: ResolvedDashboardWidget): string {
  const hero = widget.id === 'users.strip' ? ' sf-dashboard-card-hero' : ''
  if (widget.size === 'lg') {
    return `page-settings-panel page-settings-panel-wide sf-dashboard-card${hero}`
  }
  if (widget.size === 'sm') return `page-settings-panel sf-dashboard-card sf-dashboard-card-sm${hero}`
  return `page-settings-panel sf-dashboard-card${hero}`
}

function WidgetShell(props: {
  widget: ResolvedDashboardWidget
  children: React.ReactNode
}) {
  const { widget, children } = props
  return (
    <article
      className={panelClass(widget)}
      data-widget={`${widget.moduleId}:${widget.id}`}
      data-module-enabled={widget.moduleEnabled ? 'true' : 'false'}
    >
      <header className="page-settings-panel-head sf-dashboard-card-head">
        <h3>{widget.title}</h3>
      </header>
      <div className="page-settings-panel-body sf-dashboard-card-body">{children}</div>
    </article>
  )
}

async function softRenderWidget(
  Widget: React.ComponentType<Record<string, never>>,
  moduleId: string,
  id: string,
): Promise<React.ReactNode> {
  try {
    // Invoke as a function so async Server Component throws are catchable
    // (JSX `<Widget />` would surface the rejection to the page boundary).
    const node = await Promise.resolve(
      (Widget as unknown as () => React.ReactNode | Promise<React.ReactNode>)(),
    )
    return node
  } catch (error) {
    console.error(`[dashboard] widget render failed ${moduleId}/${id}`, error)
    return <p className="sf-dashboard-soft-fail">—</p>
  }
}

/** One contributed card — soft-fail so a broken pack cannot blank the page. */
export async function DashboardWidgetCard(props: {
  widget: ResolvedDashboardWidget
}) {
  const { widget } = props

  if (!widget.moduleEnabled) {
    return (
      <WidgetShell widget={widget}>
        <DashboardSoftPlaceholder
          status="module-disabled"
          hint="Enable this module under Settings → Modules to activate the card."
        />
      </WidgetShell>
    )
  }

  const Widget = await softLoadWidget(widget.moduleId, widget.id)

  if (!Widget) {
    return (
      <WidgetShell widget={widget}>
        <DashboardSoftPlaceholder status="soft-fail" />
      </WidgetShell>
    )
  }

  const body = await softRenderWidget(Widget, widget.moduleId, widget.id)

  return <WidgetShell widget={widget}>{body}</WidgetShell>
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
