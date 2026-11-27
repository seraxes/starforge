import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { decideDocumentsStaffEdit } from './staff'

describe('decideDocumentsStaffEdit', () => {
  it('lets an app admin, and a viewer with admin.documents edit, pass (success path)', () => {
    assert.equal(
      decideDocumentsStaffEdit({ isAppAdmin: true, hasDocumentsEditGrant: false }),
      true,
    )
    assert.equal(
      decideDocumentsStaffEdit({ isAppAdmin: false, hasDocumentsEditGrant: true }),
      true,
    )
    assert.equal(
      decideDocumentsStaffEdit({ isAppAdmin: true, hasDocumentsEditGrant: true }),
      true,
    )
  })

  it('refuses a viewer who is neither app admin nor admin.documents edit (failure path)', () => {
    assert.equal(
      decideDocumentsStaffEdit({ isAppAdmin: false, hasDocumentsEditGrant: false }),
      false,
    )
  })
})
