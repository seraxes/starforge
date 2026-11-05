import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  emailTypeFromModuleCategory,
  isEmailSendType,
  resolveEmailSendType,
} from './send-type'

describe('emailTypeFromModuleCategory', () => {
  it('maps system → system', () => {
    assert.equal(emailTypeFromModuleCategory('system'), 'system')
  })

  it('maps social / marketplace → marketing', () => {
    assert.equal(emailTypeFromModuleCategory('social'), 'marketing')
    assert.equal(emailTypeFromModuleCategory('marketplace'), 'marketing')
  })

  it('maps forms / auth / events / other → transactional', () => {
    assert.equal(emailTypeFromModuleCategory('forms'), 'transactional')
    assert.equal(emailTypeFromModuleCategory('auth'), 'transactional')
    assert.equal(emailTypeFromModuleCategory('events'), 'transactional')
    assert.equal(emailTypeFromModuleCategory('other'), 'transactional')
    assert.equal(emailTypeFromModuleCategory(''), 'transactional')
    assert.equal(emailTypeFromModuleCategory(null), 'transactional')
  })
})

describe('resolveEmailSendType', () => {
  it('prefers explicit emailType', () => {
    assert.equal(
      resolveEmailSendType({ emailType: 'marketing', moduleCategory: 'forms' }),
      'marketing',
    )
  })

  it('falls back to module category', () => {
    assert.equal(resolveEmailSendType({ moduleCategory: 'system' }), 'system')
  })

  it('ignores unknown emailType strings', () => {
    assert.equal(
      resolveEmailSendType({ emailType: 'nope', moduleCategory: 'social' }),
      'marketing',
    )
  })
})

describe('isEmailSendType', () => {
  it('accepts known buckets only', () => {
    assert.equal(isEmailSendType('transactional'), true)
    assert.equal(isEmailSendType('marketing'), true)
    assert.equal(isEmailSendType('system'), true)
    assert.equal(isEmailSendType('total'), false)
    assert.equal(isEmailSendType(null), false)
  })
})
