import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  bookableFromPhase,
  isBookable,
  listStationsWhileFleetAbsent,
  statusListLabel,
  statusesForCatalog,
  validateDriverCode,
  validateStatusFields,
  validateStatusReorderIds,
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

  it('phase active is bookable', () => {
    assert.equal(bookableFromPhase('active'), true)
    assert.equal(bookableFromPhase('recruiting'), false)
    assert.equal(bookableFromPhase('declined'), false)
    assert.equal(bookableFromPhase('inactive'), false)
    assert.equal(bookableFromPhase('banned'), false)

    const ok = validateStatusFields({
      name: 'Active driver',
      phase: 'active',
    })
    assert.equal(ok.ok, true)
    if (!ok.ok) return
    assert.equal(ok.values.phase, 'active')
    assert.equal(ok.values.bookable, true)
  })
})

describe('onboarding status fields', () => {
  it('refuses an empty status name', () => {
    const blank = validateStatusFields({ name: '   ', phase: 'recruiting' })
    assert.equal(blank.ok, false)
    if (blank.ok) return
    assert.match(blank.error, /name/i)

    const missing = validateStatusFields({ phase: 'active' })
    assert.equal(missing.ok, false)
    if (missing.ok) return
    assert.match(missing.error, /name/i)
  })

  it('accepts a named status with optional form id', () => {
    const ok = validateStatusFields({
      name: 'Active',
      key: 'active',
      phase: 'active',
      displayLabel: 'Active driver',
      actionChip: 'Book',
      nextStepMessage: 'You can book tours.',
      formDefinitionId: 'form_app',
      sortOrder: 2,
    })
    assert.equal(ok.ok, true)
    if (!ok.ok) return
    assert.equal(ok.values.name, 'Active')
    assert.equal(ok.values.phase, 'active')
    assert.equal(ok.values.bookable, true)
    assert.equal(ok.values.displayLabel, 'Active driver')
    assert.equal(ok.values.actionChip, 'Book')
    assert.equal(ok.values.nextStepMessage, 'You can book tours.')
    assert.equal(ok.values.formDefinitionId, 'form_app')
  })

  it('returns a new named status in the status list', () => {
    const created = validateStatusFields({
      name: 'Contact made',
      phase: 'recruiting',
      displayLabel: 'Contact made',
    })
    assert.equal(created.ok, true)
    if (!created.ok) return

    const list = statusesForCatalog([created.values])
    assert.equal(list.some((row) => row.name === 'Contact made'), true)
    assert.equal(statusListLabel(created.values), 'Contact made')
  })
})

describe('onboarding status reorder', () => {
  it('accepts a complete unique id list', () => {
    const ok = validateStatusReorderIds(['a', 'b', 'c'], ['c', 'a', 'b'])
    assert.equal(ok.ok, true)
    if (!ok.ok) return
    assert.deepEqual(ok.ids, ['a', 'b', 'c'])
  })

  it('refuses missing, partial, duplicate, or stale orders', () => {
    const empty = validateStatusReorderIds([], ['a'])
    assert.equal(empty.ok, false)
    if (empty.ok) return
    assert.match(empty.error, /missing/i)

    const partial = validateStatusReorderIds(['a'], ['a', 'b'])
    assert.equal(partial.ok, false)
    if (partial.ok) return
    assert.match(partial.error, /out of date/i)

    const dup = validateStatusReorderIds(['a', 'a'], ['a', 'b'])
    assert.equal(dup.ok, false)
    if (dup.ok) return
    assert.match(dup.error, /duplicate/i)

    const stale = validateStatusReorderIds(['a', 'x'], ['a', 'b'])
    assert.equal(stale.ok, false)
    if (stale.ok) return
    assert.match(stale.error, /out of date/i)
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
  it('returns an empty Fleet contribution (depot catalog is separate)', () => {
    assert.deepEqual(listStationsWhileFleetAbsent(), [])
  })
})
