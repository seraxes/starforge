import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  CORE_ADMIN_BASE,
  PAYLOAD_ADMIN_BASE,
  coreAdminPath,
  isCoreAdminPath,
  isPayloadAdminPath,
  payloadAdminPath,
} from './admin-paths'

describe('admin-paths', () => {
  it('keeps Core and Payload bases distinct', () => {
    assert.equal(CORE_ADMIN_BASE, '/admin')
    assert.equal(PAYLOAD_ADMIN_BASE, '/cms/admin')
  })

  it('builds nested paths', () => {
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
})
