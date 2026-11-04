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
    assert.deepEqual(adminAreaGateForPath('/app/admin/nav'), {
      type: 'resource',
      key: 'admin.nav',
    })
    assert.deepEqual(adminAreaGateForPath('/app/admin/nav/primary'), {
      type: 'resource',
      key: 'admin.nav',
    })
  })

  it('keeps Media app-admin-only until a matrix row exists', () => {
    assert.deepEqual(adminAreaGateForPath('/app/admin/media'), { type: 'app-admin' })
    assert.deepEqual(adminAreaGateForPath('/app/admin/media/settings'), {
      type: 'app-admin',
    })
  })

  it('treats /app/admin as shell entry', () => {
    assert.deepEqual(adminAreaGateForPath('/app/admin'), { type: 'shell' })
    assert.deepEqual(adminAreaGateForPath('/app/admin/'), { type: 'shell' })
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
    assert.equal(adminHrefAllowed('/app/admin/nav', false, allowed), true)
    assert.equal(adminHrefAllowed('/app/admin/users', false, allowed), false)
    assert.equal(adminHrefAllowed('/app/admin/media', false, allowed), false)
    assert.equal(
      firstAdminLandingPath({ isAppAdmin: false, allowed }),
      '/app/admin/nav',
    )
  })

  it('sends app admins to Users', () => {
    assert.equal(
      firstAdminLandingPath({ isAppAdmin: true, allowed: new Set() }),
      '/app/admin/users',
    )
  })
})
