import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  aclLevelSatisfies,
  grantLevelFromRow,
  highestAclLevel,
} from './levels'

describe('acl levels', () => {
  it('includes lower levels in a higher grant', () => {
    assert.equal(aclLevelSatisfies('manage', 'view'), true)
    assert.equal(aclLevelSatisfies('manage', 'edit'), true)
    assert.equal(aclLevelSatisfies('edit', 'manage'), false)
    assert.equal(aclLevelSatisfies('view', 'view'), true)
    assert.equal(aclLevelSatisfies(null, 'view'), false)
  })

  it('keeps the highest level across groups', () => {
    assert.equal(highestAclLevel(['view', 'edit', null]), 'edit')
    assert.equal(highestAclLevel(['manage', 'view']), 'manage')
    assert.equal(highestAclLevel([null]), null)
  })

  it('reads a legacy allowed row as manage', () => {
    assert.equal(grantLevelFromRow('none', true), 'manage')
    assert.equal(grantLevelFromRow('view', false), 'view')
    assert.equal(grantLevelFromRow('none', false), null)
  })
})
