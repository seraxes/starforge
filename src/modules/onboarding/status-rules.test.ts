import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  isBookable,
  listStationsWhileFleetAbsent,
  validateDriverCode,
  validateStatusFields,
} from './status-rules'

describe('onboarding bookable', () => {
  it('is bookable when the status flag is on', () => {
    assert.equal(isBookable(true, false), true)
    assert.equal(isBookable(true, true), true)
  })

  it('is bookable when the flag is off and vehicle access is true', () => {
    assert.equal(isBookable(false, true), true)
  })

  it('is refused when the flag is off and vehicle access is false', () => {
    assert.equal(isBookable(false, false), false)
  })
})

describe('onboarding status fields', () => {
  it('refuses an empty status name', () => {
    const blank = validateStatusFields({ name: '   ', bookable: false })
    assert.equal(blank.ok, false)
    if (blank.ok) return
    assert.match(blank.error, /name/i)

    const missing = validateStatusFields({ bookable: true })
    assert.equal(missing.ok, false)
    if (missing.ok) return
    assert.match(missing.error, /name/i)
  })

  it('accepts a named status with optional form id', () => {
    const ok = validateStatusFields({
      name: 'Active',
      key: 'active',
      bookable: true,
      formDefinitionId: 'form_app',
      sortOrder: 2,
    })
    assert.equal(ok.ok, true)
    if (!ok.ok) return
    assert.equal(ok.values.name, 'Active')
    assert.equal(ok.values.bookable, true)
    assert.equal(ok.values.formDefinitionId, 'form_app')
  })
})

describe('onboarding driver code', () => {
  it('refuses a driver code longer than 6', () => {
    const long = validateDriverCode('ABCDEFG')
    assert.equal(long.ok, false)
    if (long.ok) return
    assert.match(long.error, /6/)
  })

  it('accepts blank and up to 6 characters', () => {
    assert.deepEqual(validateDriverCode(''), { ok: true, value: null })
    assert.deepEqual(validateDriverCode('  '), { ok: true, value: null })
    assert.deepEqual(validateDriverCode('AB12'), { ok: true, value: 'AB12' })
    assert.deepEqual(validateDriverCode('ABCDEF'), { ok: true, value: 'ABCDEF' })
  })
})

describe('onboarding stations while Fleet is absent', () => {
  it('returns an empty station list', () => {
    assert.deepEqual(listStationsWhileFleetAbsent(), [])
  })
})
