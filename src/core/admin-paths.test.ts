import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  CORE_ADMIN_BASE,
  CORE_ADMIN_ROOT,
  PAYLOAD_ADMIN_BASE,
  PAYLOAD_ADMIN_ROOT,
  coreAdminPath,
  isCoreAdminPath,
  isCoreDashboardPath,
  isPayloadAdminPath,
  payloadAdminPath,
} from './admin-paths'

describe('admin-paths', () => {
  it('keeps Core and Payload bases distinct', () => {
    assert.equal(CORE_ADMIN_BASE, '/admin')
    assert.equal(PAYLOAD_ADMIN_BASE, '/cms/admin')
    assert.equal(CORE_ADMIN_ROOT, CORE_ADMIN_BASE)
    assert.equal(PAYLOAD_ADMIN_ROOT, PAYLOAD_ADMIN_BASE)
  })

  it('builds nested paths', () => {
    assert.equal(coreAdminPath(), '/admin')
    assert.equal(coreAdminPath('/'), '/admin')
    assert.equal(coreAdminPath('users'), '/admin/users')
    assert.equal(coreAdminPath('/settings'), '/admin/settings')
    assert.equal(payloadAdminPath('collections/pages'), '/cms/admin/collections/pages')
  })

  it('classifies Core vs Payload without prefix collision', () => {
    assert.equal(isCoreAdminPath('/admin'), true)
    assert.equal(isCoreAdminPath('/admin/users'), true)
    assert.equal(isCoreAdminPath('/cms/admin'), false)
    assert.equal(isCoreAdminPath('/cms/admin/collections/pages'), false)

    assert.equal(isPayloadAdminPath('/cms/admin'), true)
    assert.equal(isPayloadAdminPath('/cms/admin/login'), true)
    assert.equal(isPayloadAdminPath('/admin'), false)
    assert.equal(isPayloadAdminPath('/admin/users'), false)
  })

  it('detects Dashboard root', () => {
    assert.equal(isCoreDashboardPath('/admin'), true)
    assert.equal(isCoreDashboardPath('/admin/'), true)
    assert.equal(isCoreDashboardPath('/admin/users'), false)
    assert.equal(isCoreDashboardPath('/app/admin'), false)
  })
})
