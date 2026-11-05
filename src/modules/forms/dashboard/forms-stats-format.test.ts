import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { formatFormsLatestGlance } from './forms-glance'

describe('formatFormsLatestGlance', () => {
  it('returns null for missing / invalid dates', () => {
    assert.equal(formatFormsLatestGlance(null), null)
    assert.equal(formatFormsLatestGlance(undefined), null)
    assert.equal(formatFormsLatestGlance(new Date('nope')), null)
  })

  it('formats UTC stamp and optional formKey', () => {
    const when = new Date('2026-11-05T18:22:33.000Z')
    assert.equal(formatFormsLatestGlance(when), '2026-11-05 18:22 UTC')
    assert.equal(formatFormsLatestGlance(when, 'contact'), 'contact · 2026-11-05 18:22 UTC')
    assert.equal(formatFormsLatestGlance(when, '  '), '2026-11-05 18:22 UTC')
  })
})
