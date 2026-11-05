import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  DEFAULT_DASHBOARD_ONLINE_WINDOW_MIN,
  DEFAULT_DASHBOARD_REFRESH_INTERVAL_SEC,
  clampDashboardOnlineWindowMin,
  clampDashboardRefreshIntervalSec,
} from '@/core/settings/defaults'

import { LATEST_USERS_LIMIT, NEW_USER_WINDOW_DAYS } from './users-metric-windows'

describe('dashboard Performance clamps (D0)', () => {
  it('clamps refresh interval', () => {
    assert.equal(clampDashboardRefreshIntervalSec(undefined), DEFAULT_DASHBOARD_REFRESH_INTERVAL_SEC)
    assert.equal(clampDashboardRefreshIntervalSec(1), 15)
    assert.equal(clampDashboardRefreshIntervalSec(60), 60)
    assert.equal(clampDashboardRefreshIntervalSec(9999), 600)
  })

  it('clamps online window minutes', () => {
    assert.equal(clampDashboardOnlineWindowMin(undefined), DEFAULT_DASHBOARD_ONLINE_WINDOW_MIN)
    assert.equal(clampDashboardOnlineWindowMin(1), 5)
    assert.equal(clampDashboardOnlineWindowMin(15), 15)
    assert.equal(clampDashboardOnlineWindowMin(999), 120)
  })
})

describe('dashboard user metric windows', () => {
  it('locks newly-registered window to 10 days and latest list to 10', () => {
    assert.equal(NEW_USER_WINDOW_DAYS, 10)
    assert.equal(LATEST_USERS_LIMIT, 10)
  })
})
