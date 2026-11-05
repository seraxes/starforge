import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  ADMIN_ACCOUNT_HREF,
  ADMIN_DASHBOARD_HREF,
  ADMIN_SHELL_LOGO_TOOLTIP,
  PAYLOAD_DASHBOARD_HREF,
  adminUserInitials,
} from './admin-sidebar-chrome'

describe('adminUserInitials', () => {
  it('uses first letters of two name parts', () => {
    assert.equal(adminUserInitials('Ada Lovelace', 'ada@example.com'), 'AL')
  })

  it('uses two letters from a single name', () => {
    assert.equal(adminUserInitials('Admin', 'x@y.z'), 'AD')
  })

  it('falls back to email local-part', () => {
    assert.equal(adminUserInitials(null, 'admin@starforge.local'), 'AD')
    assert.equal(adminUserInitials('', 'z@starforge.local'), 'Z')
  })

  it('returns ? when nothing usable', () => {
    assert.equal(adminUserInitials(null, null), '?')
  })
})

describe('admin sidebar chrome constants', () => {
  it('keeps logo tooltip tied to former Starforge admin header copy', () => {
    assert.match(ADMIN_SHELL_LOGO_TOOLTIP, /^Starforge admin —/)
    assert.match(ADMIN_SHELL_LOGO_TOOLTIP, /Chrome/)
    assert.match(ADMIN_SHELL_LOGO_TOOLTIP, /CMS/)
  })

  it('points account avatar at existing /account/security', () => {
    assert.equal(ADMIN_ACCOUNT_HREF, '/account/security')
  })

  it('points STARFORGE logo at Core Dashboard /admin', () => {
    assert.equal(ADMIN_DASHBOARD_HREF, '/admin')
  })

  it('points Payload logo at /cms/admin', () => {
    assert.equal(PAYLOAD_DASHBOARD_HREF, '/cms/admin')
  })
})
