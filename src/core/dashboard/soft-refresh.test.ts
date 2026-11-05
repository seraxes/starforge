import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  DEFAULT_DASHBOARD_REFRESH_INTERVAL_SEC,
  DASHBOARD_REFRESH_INTERVAL_SEC_MAX,
  DASHBOARD_REFRESH_INTERVAL_SEC_MIN,
} from '@/core/settings/defaults'

import {
  dashboardRefreshIntervalMs,
  formatDashboardRefreshedAt,
  shouldRefreshOnBecomeVisible,
} from './soft-refresh'

describe('dashboard soft refresh (D4)', () => {
  it('maps settings seconds to poll ms with the same clamps as Performance', () => {
    assert.equal(
      dashboardRefreshIntervalMs(undefined),
      DEFAULT_DASHBOARD_REFRESH_INTERVAL_SEC * 1000,
    )
    assert.equal(dashboardRefreshIntervalMs(60), 60_000)
    assert.equal(
      dashboardRefreshIntervalMs(1),
      DASHBOARD_REFRESH_INTERVAL_SEC_MIN * 1000,
    )
    assert.equal(
      dashboardRefreshIntervalMs(9999),
      DASHBOARD_REFRESH_INTERVAL_SEC_MAX * 1000,
    )
  })

  it('refreshes on become-visible only when the interval has elapsed', () => {
    assert.equal(shouldRefreshOnBecomeVisible(0, 60_000), false)
    assert.equal(shouldRefreshOnBecomeVisible(59_999, 60_000), false)
    assert.equal(shouldRefreshOnBecomeVisible(60_000, 60_000), true)
    assert.equal(shouldRefreshOnBecomeVisible(120_000, 60_000), true)
    assert.equal(shouldRefreshOnBecomeVisible(999_999, 0), false)
  })

  it('formats Last refreshed as UTC without redesign', () => {
    const d = new Date('2026-11-05T18:09:30.123Z')
    assert.equal(formatDashboardRefreshedAt(d), '2026-11-05 18:09:30 UTC')
  })
})
