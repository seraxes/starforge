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

  it('treats a boolean grant as manage and a view grant as view-only', () => {
    assert.equal(
      decideAdminResourceAccess({
        isAppAdmin: false,
        isRegistered: true,
        groupAllows: true,
        minLevel: 'manage',
      }),
      true,
    )
    assert.equal(
      decideAdminResourceAccess({
        isAppAdmin: false,
        isRegistered: true,
        heldLevel: 'view',
        minLevel: 'edit',
      }),
      false,
    )
    assert.equal(
      decideAdminResourceAccess({
        isAppAdmin: false,
        isRegistered: true,
        heldLevel: 'manage',
        minLevel: 'edit',
      }),
      true,
    )
    assert.equal(
      decideAdminResourceAccess({
        isAppAdmin: false,
        isRegistered: true,
        heldLevel: null,
        minLevel: 'view',
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

  it('maps Media to admin.media', () => {
    assert.deepEqual(adminAreaGateForPath('/admin/media'), {
      type: 'resource',
      key: 'admin.media',
    })
    assert.deepEqual(adminAreaGateForPath('/admin/media/settings'), {
      type: 'resource',
      key: 'admin.media',
    })
    assert.equal(
      adminHrefAllowed('/admin/media', false, new Set(['admin.media'])),
      true,
    )
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

  it('maps Ads admin paths to admin.ads', () => {
    assert.deepEqual(adminAreaGateForPath('/admin/ads'), {
      type: 'resource',
      key: 'admin.ads',
    })
    assert.deepEqual(adminAreaGateForPath('/admin/ads/placements'), {
      type: 'resource',
      key: 'admin.ads',
    })
    assert.deepEqual(adminAreaGateForPath('/admin/ads/campaigns'), {
      type: 'resource',
      key: 'admin.ads',
    })
  })

  it('maps Marketplace admin paths to admin.marketplace', () => {
    assert.deepEqual(adminAreaGateForPath('/admin/marketplace'), {
      type: 'resource',
      key: 'admin.marketplace',
    })
    assert.deepEqual(adminAreaGateForPath('/admin/marketplace/listings'), {
      type: 'resource',
      key: 'admin.marketplace',
    })
    assert.deepEqual(adminAreaGateForPath('/admin/marketplace/settings'), {
      type: 'resource',
      key: 'admin.marketplace',
    })
  })

  it('maps Pages admin paths to admin.pages', () => {
    assert.deepEqual(adminAreaGateForPath('/admin/pages'), {
      type: 'resource',
      key: 'admin.pages',
    })
    assert.deepEqual(adminAreaGateForPath('/admin/pages/new'), {
      type: 'resource',
      key: 'admin.pages',
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

  it('maps Social admin paths to admin.social', () => {
    assert.deepEqual(adminAreaGateForPath('/admin/social'), {
      type: 'resource',
      key: 'admin.social',
    })
    assert.deepEqual(adminAreaGateForPath('/admin/social/settings'), {
      type: 'resource',
      key: 'admin.social',
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

  it('maps /admin/audit to admin.audit and still hides it without that grant', () => {
    assert.deepEqual(adminAreaGateForPath('/admin/audit'), {
      type: 'resource',
      key: 'admin.audit',
    })
    const member = { isAppAdmin: false, isRegistered: true }
    const allowed = new Set(['admin.settings', 'admin.users'] as const)
    assert.equal(
      viewerAllowsGate(member, adminAreaGateForPath('/admin/audit'), allowed),
      false,
    )
    assert.equal(adminHrefAllowed('/admin/audit', false, allowed), false)
    const readers = new Set(['admin.audit'] as const)
    assert.equal(
      viewerAllowsGate(member, adminAreaGateForPath('/admin/audit'), readers),
      true,
    )
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
