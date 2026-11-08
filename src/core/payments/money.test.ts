import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  computeMoneyLine,
  currencyExponent,
  formatMoneyMinor,
  majorToMinor,
  sumMoneyLines,
} from './money'

describe('payments money', () => {
  it('uses HUF exponent 0', () => {
    assert.equal(currencyExponent('HUF'), 0)
    assert.equal(majorToMinor(5000, 'HUF'), 5000)
  })

  it('computes gross-first VAT 27%', () => {
    const line = computeMoneyLine({
      currency: 'HUF',
      qty: 2,
      unitAmountMinor: 12700,
      vatRateBps: 2700,
      amountIsGross: true,
    })
    assert.equal(line.unitGrossMinor, 12700)
    assert.equal(line.unitNetMinor, 10000)
    assert.equal(line.lineGrossMinor, 25400)
    assert.equal(line.lineNetMinor, 20000)
    assert.equal(line.vatAmountMinor, 5400)
  })

  it('sums lines', () => {
    const a = computeMoneyLine({
      currency: 'HUF',
      qty: 1,
      unitAmountMinor: 12700,
      vatRateBps: 2700,
      amountIsGross: true,
    })
    const totals = sumMoneyLines([a])
    assert.equal(totals.totalGrossMinor, 12700)
    assert.equal(totals.totalNetMinor, 10000)
  })

  it('formats HUF', () => {
    const s = formatMoneyMinor(5000, 'HUF', 'hu-HU')
    assert.ok(s.includes('5') || s.includes('5'))
  })
})
