import React from 'react'
import Link from 'next/link'

import { coreAdminPath } from '@/core/admin-paths'
import { DashboardSoftPlaceholder } from '@/core/dashboard/widgets/DashboardSoftPlaceholder'

import { loadSystemHealthStats } from './system-health-stats'
import type { HealthLevel } from './system-health'

const HEALTH_ROWS = [
  { key: 'database', label: 'Database' },
  { key: 'redis', label: 'Redis' },
  { key: 'media', label: 'Media storage' },
  { key: 'migrations', label: 'Migrations' },
] as const

function chipClass(level: HealthLevel): string {
  if (level === 'fail') return 'sf-dashboard-chip sf-dashboard-chip-fail'
  if (level === 'warn') return 'sf-dashboard-chip sf-dashboard-chip-warn'
  if (level === 'ok') return 'sf-dashboard-chip sf-dashboard-chip-ok'
  return 'sf-dashboard-chip'
}

/**
 * Core Dashboard card — DB, Redis when selected, media storage, migration version.
 * No secrets in the payload.
 */
export async function SystemHealthWidget() {
  const result = await loadSystemHealthStats()

  if (!result.ok) {
    return (
      <DashboardSoftPlaceholder
        status="soft-fail"
        hint="Database, Redis, media storage, and migration version appear here when the probes can run."
        rows={HEALTH_ROWS.map((entry) => ({ label: entry.label, value: '—' }))}
        footerHref={coreAdminPath('/site-chrome/environment')}
        footerLabel="Open Environment"
      />
    )
  }

  return (
    <div className="sf-dashboard-health" aria-label="System health">
      <p className="sf-dashboard-health-rollup">
        <span className={chipClass(result.data.level)}>{result.data.levelLabel}</span>
      </p>
      <dl className="sf-dashboard-placeholder-rows">
        {result.data.rows.map((row) => (
          <div key={row.key} className="sf-dashboard-placeholder-row">
            <dt>{row.label}</dt>
            <dd>
              <span className={chipClass(row.level)}>{row.value}</span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="sf-dashboard-card-foot">
        <Link href={coreAdminPath('/site-chrome/environment')}>Open Environment</Link>
      </p>
    </div>
  )
}

export default SystemHealthWidget
