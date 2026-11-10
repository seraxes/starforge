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
    const core = widgets.filter((w) => w.moduleId === 'platform:dashboard')
    const ids = core.map((w) => w.id)
    assert.ok(ids.includes('attention.rail'), `expected attention.rail in ${ids.join(',')}`)
    assert.ok(ids.includes('users.strip'), `expected users.strip in ${ids.join(',')}`)
    assert.ok(ids.includes('users.latest'), `expected users.latest in ${ids.join(',')}`)
    assert.ok(ids.includes('system.health'), `expected system.health in ${ids.join(',')}`)
    assert.ok(ids.includes('chrome.posture'), `expected chrome.posture in ${ids.join(',')}`)
    assert.ok(ids.includes('modules.summary'), `expected modules.summary in ${ids.join(',')}`)
    assert.ok(ids.includes('host.pulse'), `expected host.pulse in ${ids.join(',')}`)
    assert.ok(core.every((w) => w.moduleEnabled))
    assert.equal(core[0]?.id, 'attention.rail')
    assert.ok(core.every((w) => w.order < 50))
    assert.ok(core[0]!.order < core[1]!.order)
  })

  it('keeps soft shells when module toggle is off (moduleEnabled false)', () => {
    const widgets = resolveDashboardWidgets({
      enabledModuleIds: [],
      allowedAreas: null,
    })
    assert.ok(widgets.length >= 2, 'expected Core + product soft shells')
    assert.ok(widgets.every((w) => w.moduleEnabled === false))
  })

  it('marks product:media / email-manager enabled independently', () => {
    const widgets = resolveDashboardWidgets({
      enabledModuleIds: ['platform:dashboard', 'product:media'],
      allowedAreas: null,
    })
    const media = widgets.find((w) => w.id === 'media.counts')
    const email = widgets.find((w) => w.id === 'email.sent')
    assert.ok(media, 'expected media.counts contribution')
    assert.equal(media.moduleEnabled, true)
    assert.ok(email, 'expected email.sent contribution')
    assert.equal(email.moduleEnabled, false)
  })

  it('filters by ACL area when allowedAreas is set', () => {
    const denied = resolveDashboardWidgets({
      enabledModuleIds: ['platform:dashboard'],
      allowedAreas: new Set(['admin.nav'] as const),
    })
    assert.equal(
      denied.filter((w) => w.moduleId === 'platform:dashboard').length,
      0,
    )

    const allowed = resolveDashboardWidgets({
      enabledModuleIds: ['platform:dashboard'],
      allowedAreas: new Set(['admin.dashboard'] as const),
    })
    assert.ok(allowed.filter((w) => w.moduleId === 'platform:dashboard').length >= 2)
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
