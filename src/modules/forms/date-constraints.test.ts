import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  normalizeDateString,
  normalizeTimeValue,
  validateDateTimeValue,
} from './date-constraints'
import type { FormFieldDef } from './types'

describe('date constraints', () => {
  it('normalizes date and time shapes', () => {
    assert.equal(normalizeDateString('2026-11-03'), '2026-11-03')
    assert.equal(normalizeDateString('2026-13-01'), null)
    assert.equal(normalizeTimeValue('09:05:00'), '09:05')
  })

  it('enforces min/max on date fields', () => {
    const field: FormFieldDef = {
      name: 'day',
      label: 'Day',
      type: 'date',
      constraints: { min: '2026-01-01', max: '2026-12-31' },
    }
    assert.equal(validateDateTimeValue(field, '2026-06-15'), null)
    assert.ok(validateDateTimeValue(field, '2025-12-31'))
  })
})
