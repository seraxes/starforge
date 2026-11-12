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

  it('maps Payments admin paths to admin.payments', () => {
    assert.deepEqual(adminAreaGateForPath('/admin/payments'), {
      type: 'resource',
      key: 'admin.payments',
    })
    assert.deepEqual(adminAreaGateForPath('/admin/payments/orders'), {
      type: 'resource',
      key: 'admin.payments',
    })
    assert.deepEqual(adminAreaGateForPath('/admin/payments/settings'), {
      type: 'resource',
      key: 'admin.payments',
    })
  })

  it('maps Subscriptions admin paths to admin.subscriptions', () => {
    assert.deepEqual(adminAreaGateForPath('/admin/subscriptions'), {
      type: 'resource',
      key: 'admin.subscriptions',
    })
    assert.deepEqual(adminAreaGateForPath('/admin/subscriptions/subscribers'), {
      type: 'resource',
      key: 'admin.subscriptions',
    })
  })

  it('maps Events admin paths to admin.events', () => {
    assert.deepEqual(adminAreaGateForPath('/admin/events'), {
      type: 'resource',
      key: 'admin.events',
    })
    assert.deepEqual(adminAreaGateForPath('/admin/events/venues'), {
      type: 'resource',
      key: 'admin.events',
    })
    assert.deepEqual(adminAreaGateForPath('/admin/events/settings'), {
      type: 'resource',
      key: 'admin.events',
    })
  })

  it('maps Profiles admin paths to admin.profiles', () => {
    assert.deepEqual(adminAreaGateForPath('/admin/profiles'), {
      type: 'resource',
      key: 'admin.profiles',
    })
    assert.deepEqual(adminAreaGateForPath('/admin/profiles/settings'), {
      type: 'resource',
      key: 'admin.profiles',
    })
    assert.deepEqual(adminAreaGateForPath('/admin/profiles/user-1'), {
      type: 'resource',
      key: 'admin.profiles',
    })
  })

  it('maps Maps admin paths to admin.maps', () => {
    assert.deepEqual(adminAreaGateForPath('/admin/maps'), {
      type: 'resource',
      key: 'admin.maps',
    })
    assert.deepEqual(adminAreaGateForPath('/admin/maps/room-1'), {
      type: 'resource',
      key: 'admin.maps',
    })
  })

  it('maps Localization to admin.localization', () => {
    assert.deepEqual(adminAreaGateForPath('/admin/localization'), {
      type: 'resource',
      key: 'admin.localization',
    })
    assert.deepEqual(adminAreaGateForPath('/admin/localization/'), {
      type: 'resource',
      key: 'admin.localization',
    })
  })

  it('maps Skins under Layouts to admin.layouts', () => {
    assert.deepEqual(adminAreaGateForPath('/admin/skins'), {
      type: 'resource',
      key: 'admin.layouts',
    })
    assert.deepEqual(adminAreaGateForPath('/admin/skins/'), {
      type: 'resource',
      key: 'admin.layouts',
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

  it('keeps /admin/audit off the member matrix', () => {
    assert.deepEqual(adminAreaGateForPath('/admin/audit'), { type: 'app-admin' })
    const member = { isAppAdmin: false, isRegistered: true }
    const allowed = new Set(['admin.settings', 'admin.users'] as const)
    assert.equal(
      viewerAllowsGate(member, adminAreaGateForPath('/admin/audit'), allowed),
      false,
    )
    assert.equal(adminHrefAllowed('/admin/audit', false, allowed), false)
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
