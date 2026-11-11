import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { evaluateFormExpression, formatComputedNumber } from './expr'

describe('evaluateFormExpression', () => {
  it('adds field refs and literals', () => {
    const result = evaluateFormExpression('price * qty', { price: '10', qty: '3' })
    assert.equal(result.ok, true)
    if (result.ok) assert.equal(result.value, 30)
  })

  it('supports sum()', () => {
    const result = evaluateFormExpression('sum(a, b, 1)', { a: 2, b: 3 })
    assert.equal(result.ok, true)
    if (result.ok) assert.equal(result.value, 6)
  })

  it('rejects empty expressions', () => {
    const result = evaluateFormExpression('  ', {})
    assert.equal(result.ok, false)
  })
})

describe('formatComputedNumber', () => {
  it('formats to precision', () => {
    assert.equal(formatComputedNumber(1.2345, 2), '1.23')
  })
})
