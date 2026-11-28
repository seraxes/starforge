import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  isValidUntilExpired,
  isValidUntilMissing,
  presenceOnlyValidUntil,
  validatePersonValidUntilFields,
  validUntilState,
} from './valid-until-rules'

describe('onboarding valid-until missing vs expired', () => {
  it('treats an empty valid-until as missing, not expired', () => {
    assert.equal(isValidUntilMissing(''), true)
    assert.equal(isValidUntilMissing('   '), true)
    assert.equal(isValidUntilMissing(null), true)
    assert.equal(isValidUntilMissing(undefined), true)
    assert.equal(isValidUntilExpired(''), false)
    assert.equal(isValidUntilExpired('   '), false)
    assert.equal(validUntilState(''), 'missing')
    assert.equal(presenceOnlyValidUntil(), '')
    assert.equal(isValidUntilExpired(presenceOnlyValidUntil()), false)
  })

  it('treats a date in the past as expired', () => {
    const asOf = new Date('2026-11-27T12:00:00')
    assert.equal(isValidUntilMissing('2020-01-15'), false)
    assert.equal(isValidUntilExpired('2020-01-15', asOf), true)
    assert.equal(isValidUntilExpired('2026-11-26', asOf), true)
    assert.equal(validUntilState('2026-11-26', asOf), 'expired')
  })

  it('treats a date in the future as not expired', () => {
    const asOf = new Date('2026-11-27T12:00:00')
    assert.equal(isValidUntilMissing('2027-06-01'), false)
    assert.equal(isValidUntilExpired('2027-06-01', asOf), false)
    assert.equal(isValidUntilExpired('2026-11-27', asOf), false)
    assert.equal(validUntilState('2027-06-01', asOf), 'valid')
    assert.equal(validUntilState('2026-11-27', asOf), 'valid')
  })
})

describe('onboarding person valid-until fields', () => {
  it('accepts the three dates and keeps empty as missing', () => {
    const ok = validatePersonValidUntilFields({
      userId: 'user_driver',
      drivingLicenceValidUntil: '2027-01-01',
      healthBookletValidUntil: '',
      contractValidUntil: '2025-01-01',
    })
    assert.equal(ok.ok, true)
    if (!ok.ok) return
    assert.equal(ok.values.slots.length, 3)
    assert.equal(ok.values.slots[0]?.kind, 'driving_licence')
    assert.equal(ok.values.slots[0]?.validUntil, '2027-01-01')
    assert.equal(ok.values.slots[1]?.kind, 'health_booklet')
    assert.equal(ok.values.slots[1]?.validUntil, '')
    assert.equal(isValidUntilExpired(ok.values.slots[1]?.validUntil), false)
    assert.equal(ok.values.slots[2]?.kind, 'contract')
  })

  it('refuses a missing user id', () => {
    const bad = validatePersonValidUntilFields({
      userId: '',
      drivingLicenceValidUntil: '2027-01-01',
    })
    assert.equal(bad.ok, false)
  })
})
