import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  adminAreaGateForPath,
  adminHrefAllowed,
  decideAdminResourceAccess,
  decideAdminShellAccess,
  firstAdminLandingPath,
  viewerAllowsGate,
} from './decide'

describe('decideAdminResourceAccess', () => {
  it('lets app admins through without a group grant', () => {
    assert.equal(
      decideAdminResourceAccess({
        isAppAdmin: true,
        isRegistered: true,
        groupAllows: false,
      }),
      true,
    )
  })

  it('denies anonymous viewers', () => {
    assert.equal(
      decideAdminResourceAccess({
        isAppAdmin: false,
        isRegistered: false,
        groupAllows: true,
      }),
      false,
    )
  })

  it('allows registered members only when a group grants the resource', () => {
    assert.equal(
      decideAdminResourceAccess({
        isAppAdmin: false,
        isRegistered: true,
        groupAllows: true,
      }),
      true,
    )
    assert.equal(
      decideAdminResourceAccess({
        isAppAdmin: false,
        isRegistered: true,
        groupAllows: false,
      }),
      false,
    )
  })
})

describe('decideAdminShellAccess', () => {
  it('models Managers as members with any matrix grant', () => {
    assert.equal(
      decideAdminShellAccess({
        isAppAdmin: false,
        isRegistered: true,
        hasAnyAdminGrant: true,
      }),
      true,
    )
    assert.equal(
      decideAdminShellAccess({
        isAppAdmin: false,
        isRegistered: true,
        hasAnyAdminGrant: false,
      }),
      false,
    )
  })
})

describe('adminAreaGateForPath', () => {
  it('maps Navigation to admin.nav (first real gate)', () => {
    assert.deepEqual(adminAreaGateForPath('/admin/nav'), {
      type: 'resource',
      key: 'admin.nav',
    })
    assert.deepEqual(adminAreaGateForPath('/admin/nav/primary'), {
      type: 'resource',
      key: 'admin.nav',
    })
  })

  it('keeps Media app-admin-only until a matrix row exists', () => {
    assert.deepEqual(adminAreaGateForPath('/admin/media'), { type: 'app-admin' })
    assert.deepEqual(adminAreaGateForPath('/admin/media/settings'), {
      type: 'app-admin',
    })
  })

  it('maps Email Manager admin paths to admin.email-manager', () => {
    assert.deepEqual(adminAreaGateForPath('/admin/email'), {
      type: 'resource',
      key: 'admin.email-manager',
    })
    assert.deepEqual(adminAreaGateForPath('/admin/email/templates'), {
      type: 'resource',
      key: 'admin.email-manager',
    })
    assert.deepEqual(adminAreaGateForPath('/admin/email/sends'), {
      type: 'resource',
      key: 'admin.email-manager',
    })
  })

  it('maps Dashboard root to admin.dashboard (/admin + legacy /app/admin)', () => {
    assert.deepEqual(adminAreaGateForPath('/admin'), {
      type: 'resource',
      key: 'admin.dashboard',
    })
    assert.deepEqual(adminAreaGateForPath('/admin/'), {
      type: 'resource',
      key: 'admin.dashboard',
    })
    assert.deepEqual(adminAreaGateForPath('/app/admin'), {
      type: 'resource',
      key: 'admin.dashboard',
    })
    assert.deepEqual(adminAreaGateForPath('/app/admin/'), {
      type: 'resource',
      key: 'admin.dashboard',
    })
  })
})

describe('viewerAllowsGate + landing', () => {
  const member = { isAppAdmin: false, isRegistered: true }

  it('allows Managers with admin.nav on Navigation only', () => {
    const allowed = new Set(['admin.nav'] as const)
    assert.equal(
      viewerAllowsGate(member, { type: 'resource', key: 'admin.nav' }, allowed),
      true,
    )
    assert.equal(
      viewerAllowsGate(member, { type: 'resource', key: 'admin.users' }, allowed),
      false,
    )
    assert.equal(viewerAllowsGate(member, { type: 'shell' }, allowed), true)
    assert.equal(viewerAllowsGate(member, { type: 'app-admin' }, allowed), false)
    assert.equal(adminHrefAllowed('/admin/nav', false, allowed), true)
    assert.equal(adminHrefAllowed('/admin/users', false, allowed), false)
    assert.equal(adminHrefAllowed('/admin/media', false, allowed), false)
    assert.equal(
      firstAdminLandingPath({ isAppAdmin: false, allowed }),
      '/admin/nav',
    )
  })

  it('sends app admins to Dashboard', () => {
    assert.equal(
      firstAdminLandingPath({ isAppAdmin: true, allowed: new Set() }),
      '/admin',
    )
  })

  it('lands Managers with admin.dashboard on Dashboard', () => {
    const allowed = new Set(['admin.dashboard', 'admin.nav'] as const)
    assert.equal(
      firstAdminLandingPath({ isAppAdmin: false, allowed }),
      '/admin',
    )
    assert.equal(adminHrefAllowed('/admin', false, allowed), true)
  })
})
