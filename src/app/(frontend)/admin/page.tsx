import React from 'react'
import Link from 'next/link'

import { CORE_ADMIN_ROOT, PAYLOAD_ADMIN_ROOT } from '@/core/admin-paths'
import {
  DashboardWidgetGrid,
  resolveDashboardWidgets,
  resolveEnabledDashboardModuleIds,
} from '@/core/dashboard'
import {
  getAccessViewer,
  listViewerAllowedAdminResources,
  type AclAdminResourceKey,
} from '@/core/acl'
import {
  ensureSiteSettingsDefaults,
  isCatalogModuleEnabled,
} from '@/core/settings'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Dashboard — Starforge',
  description: 'Starforge admin Dashboard — site performance at a glance.',
}

/** Starforge Dashboard — canonical URL `/admin` (Payload at `/cms/admin`). */
export default async function CoreAdminDashboardPage() {
  const settings = await ensureSiteSettingsDefaults()
  const viewer = await getAccessViewer()
  const allowed: ReadonlySet<AclAdminResourceKey> | null = viewer.isAppAdmin
    ? null
    : await listViewerAllowedAdminResources(viewer)

  const enabledModuleIds = resolveEnabledDashboardModuleIds((moduleId) =>
    isCatalogModuleEnabled(settings, moduleId),
  )

  // Also mark modules that contribute widgets but are catalog-off so soft
  // shells still resolve (Media required stays on; Email can toggle off).
  const widgets = resolveDashboardWidgets({
    enabledModuleIds,
    allowedAreas: allowed,
  })

  const refreshedAt = new Date()
  const refreshSec = settings.dashboardRefreshIntervalSec

  return (
    <section className="admin-section admin-layouts-full sf-dashboard">
      <header className="sf-dashboard-page-head page-settings-panel">
        <div className="page-settings-panel-head">
          <h2>Dashboard</h2>
        </div>
        <div className="page-settings-panel-body">
          <p className="lede admin-lede">
            Site performance at a glance. Module cards use soft placeholders (“—” / Coming soon /
            Module disabled) when data is not wired or the pack is off under{' '}
            <Link href={`${CORE_ADMIN_ROOT}/settings`}>Settings → Modules</Link>. Payload CMS:{' '}
            <Link href={PAYLOAD_ADMIN_ROOT}>{PAYLOAD_ADMIN_ROOT}</Link>.
          </p>
          <p className="sf-dashboard-refreshed">
            Last refreshed{' '}
            <time dateTime={refreshedAt.toISOString()}>
              {refreshedAt.toISOString().replace('T', ' ').slice(0, 19)} UTC
            </time>
            <span className="sf-dashboard-stat-hint">
              {' '}
              · refresh interval {refreshSec}s (Settings → Performance)
            </span>
          </p>
        </div>
      </header>

      {widgets.length > 0 ? (
        <DashboardWidgetGrid widgets={widgets} />
      ) : (
        <p className="sf-dashboard-empty lede admin-lede">
          No dashboard cards yet. Enable modules under Settings → Modules to add Media, Email, and
          other widgets.
        </p>
      )}
    </section>
  )
}
