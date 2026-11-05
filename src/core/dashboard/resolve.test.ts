import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  dashboardAreaToAclKey,
  resolveDashboardWidgets,
  resolveEnabledDashboardModuleIds,
} from './resolve'

describe('dashboardAreaToAclKey', () => {
  it('defaults omit / empty to admin.dashboard', () => {
    assert.equal(dashboardAreaToAclKey(undefined), 'admin.dashboard')
    assert.equal(dashboardAreaToAclKey(''), 'admin.dashboard')
    assert.equal(dashboardAreaToAclKey('dashboard'), 'admin.dashboard')
  })

  it('prefixes short areas and keeps full keys', () => {
    assert.equal(dashboardAreaToAclKey('media'), 'admin.media')
    assert.equal(dashboardAreaToAclKey('admin.email-manager'), 'admin.email-manager')
  })
})

describe('resolveDashboardWidgets', () => {
  it('includes platform:dashboard Core widgets when enabled', () => {
    const widgets = resolveDashboardWidgets({
      enabledModuleIds: ['platform:dashboard'],
      allowedAreas: null,
    })
    const ids = widgets.map((w) => w.id)
    assert.ok(ids.includes('users.strip'), `expected users.strip in ${ids.join(',')}`)
    assert.ok(ids.includes('users.latest'), `expected users.latest in ${ids.join(',')}`)
    assert.ok(widgets.every((w) => w.moduleId === 'platform:dashboard'))
    assert.ok(widgets[0]!.order < widgets[1]!.order)
  })

  it('skips widgets when module toggle is off', () => {
    const widgets = resolveDashboardWidgets({
      enabledModuleIds: [],
      allowedAreas: null,
    })
    assert.equal(widgets.length, 0)
  })

  it('filters by ACL area when allowedAreas is set', () => {
    const denied = resolveDashboardWidgets({
      enabledModuleIds: ['platform:dashboard'],
      allowedAreas: new Set(['admin.nav'] as const),
    })
    assert.equal(denied.length, 0)

    const allowed = resolveDashboardWidgets({
      enabledModuleIds: ['platform:dashboard'],
      allowedAreas: new Set(['admin.dashboard'] as const),
    })
    assert.ok(allowed.length >= 2)
  })
})

describe('resolveEnabledDashboardModuleIds', () => {
  it('derives from contributions + catalog predicate', () => {
    const enabled = resolveEnabledDashboardModuleIds(
      (id) => id === 'platform:dashboard',
    )
    assert.ok(enabled.has('platform:dashboard'))
    assert.equal(enabled.has('product:media'), false)
  })
})
