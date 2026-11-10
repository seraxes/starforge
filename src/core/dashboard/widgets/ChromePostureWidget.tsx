import React from 'react'
import Link from 'next/link'

import { coreAdminPath } from '@/core/admin-paths'
import { DashboardSoftPlaceholder } from '@/core/dashboard/widgets/DashboardSoftPlaceholder'

import { loadChromePostureStats } from './chrome-posture-stats'

const CHROME_ROWS = [
  { key: 'site', label: 'Site' },
  { key: 'indexing', label: 'Indexing' },
  { key: 'captcha', label: 'Captcha' },
] as const

/**
 * Core Dashboard card — offline, robots / indexing, captcha. Not a settings form.
 */
export async function ChromePostureWidget() {
  const result = await loadChromePostureStats()

  if (!result.ok) {
    return (
      <DashboardSoftPlaceholder
        status={result.status === 'unavailable' ? 'unavailable' : 'soft-fail'}
        hint="Offline, indexing, and captcha posture appear here when Site Chrome is reachable."
        rows={CHROME_ROWS.map((entry) => ({ label: entry.label, value: '—' }))}
        footerHref={coreAdminPath('/site-chrome')}
        footerLabel="Open Site Chrome"
      />
    )
  }

  return (
    <div className="sf-dashboard-chrome" aria-label="Site Chrome posture">
      <dl className="sf-dashboard-placeholder-rows">
        {result.data.rows.map((row) => (
          <div key={row.key} className="sf-dashboard-placeholder-row">
            <dt>{row.label}</dt>
            <dd>
              {row.warn ? (
                <span className="sf-dashboard-chip sf-dashboard-chip-warn">{row.value}</span>
              ) : (
                row.value
              )}
            </dd>
          </div>
        ))}
      </dl>
      <p className="sf-dashboard-card-foot">
        <Link href={coreAdminPath('/site-chrome')}>Open Site Chrome</Link>
      </p>
    </div>
  )
}

export default ChromePostureWidget
