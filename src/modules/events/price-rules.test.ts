import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  formatPriceModifierInput,
  parsePriceModifierInput,
  parseTierPriceRules,
  priceRulesFromForm,
  quoteTierMajor,
  sumFormPriceAddons,
  parseEventCurrency,
} from './price-rules'

const start = new Date('2026-12-01T12:00:00.000Z')

describe('quoteTierMajor', () => {
  it('adds the fixed per-tier modifier to the base', () => {
    assert.equal(
      quoteTierMajor({ price: 5000, priceModifier: 500, startsAt: start, now: start }),
      5500,
    )
  })

  it('uses the event base when the ticket type has no price', () => {
    const rules = {
      time: [{ withinMinutes: 48 * 60, mode: 'amount' as const, value: 1000 }],
      sold: null,
    }
    const near = new Date(start.getTime() - 24 * 60 * 60_000)
    assert.equal(
      quoteTierMajor({
        eventPrice: 4000,
        price: null,
        priceModifier: 500,
        rules,
        startsAt: start,
        now: near,
      }),
      5500,
    )
  })

  it('lets a ticket type price replace the event base', () => {
    assert.equal(
      quoteTierMajor({
        eventPrice: 4000,
        price: 8000,
        priceModifier: 200,
        startsAt: start,
        now: start,
      }),
      8200,
    )
  })

  it('applies a percent time rule only inside the window, of the base', () => {
    const rules = {
      time: [{ withinMinutes: 48 * 60, mode: 'percent' as const, value: 20 }],
      sold: null,
    }
    const far = new Date(start.getTime() - 10 * 24 * 60 * 60_000)
    const near = new Date(start.getTime() - 24 * 60 * 60_000)
    assert.equal(
      quoteTierMajor({ price: 5000, priceModifier: 0, rules, startsAt: start, now: far }),
      5000,
    )
    assert.equal(
      quoteTierMajor({ price: 5000, priceModifier: 100, rules, startsAt: start, now: near }),
      6100,
    )
  })

  it('applies a sold-count amount once the threshold is met', () => {
    const rules = {
      time: [],
      sold: { basis: 'count' as const, threshold: 10, mode: 'amount' as const, value: 1000 },
    }
    assert.equal(
      quoteTierMajor({ price: 4000, priceModifier: 0, rules, sold: 9, capacity: 40 }),
      4000,
    )
    assert.equal(
      quoteTierMajor({ price: 4000, priceModifier: 0, rules, sold: 10, capacity: 40 }),
      5000,
    )
  })

  it('adds form option prices on top', () => {
    assert.equal(
      quoteTierMajor({ price: 1000, priceModifier: 0, formAddonMajor: 250 }),
      1250,
    )
  })

  it('uses member price when the buyer has events.member', () => {
    assert.equal(
      quoteTierMajor({
        price: 5000,
        memberPrice: 3000,
        hasMemberEntitlement: true,
        priceModifier: 0,
      }),
      3000,
    )
    assert.equal(
      quoteTierMajor({
        price: 5000,
        memberPrice: 3000,
        hasMemberEntitlement: false,
        priceModifier: 0,
      }),
      5000,
    )
  })

  it('prefers a matching group price over member price', () => {
    assert.equal(
      quoteTierMajor({
        price: 5000,
        memberPrice: 3000,
        hasMemberEntitlement: true,
        groupPrices: [{ groupId: 'club-a', price: 2000 }],
        audienceGroupIds: ['club-a'],
        priceModifier: 100,
      }),
      2100,
    )
  })

  it('uses only the shortest matching time band, as a percent of the price in effect', () => {
    const rules = {
      time: [
        { withinMinutes: 7 * 24 * 60, mode: 'percent' as const, value: 10 },
        { withinMinutes: 48 * 60, mode: 'amount' as const, value: 500 },
        { withinMinutes: 6 * 60, mode: 'percent' as const, value: 20 },
      ],
      sold: null,
    }
    const week = new Date(start.getTime() - 5 * 24 * 60 * 60_000)
    const hours10 = new Date(start.getTime() - 10 * 60 * 60_000)
    const hour = new Date(start.getTime() - 60 * 60_000)
    const far = new Date(start.getTime() - 10 * 24 * 60 * 60_000)
    assert.equal(
      quoteTierMajor({ price: 10000, priceModifier: 0, rules, startsAt: start, now: week }),
      11000,
    )
    assert.equal(
      quoteTierMajor({ price: 10000, priceModifier: 0, rules, startsAt: start, now: hours10 }),
      10500,
    )
    assert.equal(
      quoteTierMajor({ price: 10000, priceModifier: 0, rules, startsAt: start, now: hour }),
      12000,
    )
    assert.equal(
      quoteTierMajor({ price: 10000, priceModifier: 0, rules, startsAt: start, now: far }),
      10000,
    )
    const past = new Date(start.getTime() + 60 * 60_000)
    assert.equal(
      quoteTierMajor({ price: 10000, priceModifier: 0, rules, startsAt: start, now: past }),
      12000,
    )
  })

  it('lets the later equal window win and still applies the ticket price that replaced the base', () => {
    const rules = {
      time: [
        { withinMinutes: 48 * 60, mode: 'amount' as const, value: 100 },
        { withinMinutes: 48 * 60, mode: 'percent' as const, value: 10 },
      ],
      sold: null,
    }
    const near = new Date(start.getTime() - 60 * 60_000)
    assert.equal(
      quoteTierMajor({
        eventPrice: 4000,
        price: 8000,
        priceModifier: { mode: 'percent', value: 10 },
        rules,
        startsAt: start,
        now: near,
      }),
      9600,
    )
  })

  it('adds the single sold rule on top of the active band, each of the price in effect', () => {
    const rules = {
      time: [{ withinMinutes: 48 * 60, mode: 'amount' as const, value: 500 }],
      sold: { basis: 'count' as const, threshold: 10, mode: 'percent' as const, value: 10 },
    }
    const near = new Date(start.getTime() - 60 * 60_000)
    assert.equal(
      quoteTierMajor({
        price: 10000,
        priceModifier: 0,
        rules,
        startsAt: start,
        now: near,
        sold: 9,
      }),
      10500,
    )
    assert.equal(
      quoteTierMajor({
        price: 10000,
        priceModifier: 0,
        rules,
        startsAt: start,
        now: near,
        sold: 10,
      }),
      11500,
    )
  })

  it('applies a percent ticket-type modifier of the price in effect', () => {
    assert.equal(
      quoteTierMajor({
        price: 5000,
        priceModifier: 10,
        priceModifierMode: 'percent',
      }),
      5500,
    )
    assert.equal(
      quoteTierMajor({
        eventPrice: 4000,
        price: null,
        priceModifier: { mode: 'percent', value: -25 },
      }),
      3000,
    )
  })
})

describe('parseTierPriceRules', () => {
  it('keeps a legacy single time rule as one band and still reads one sold rule', () => {
    assert.deepEqual(
      parseTierPriceRules({
        time: { withinMinutes: 120, mode: 'amount', value: 50 },
        sold: { basis: 'count', threshold: 4, mode: 'percent', value: -10 },
      }),
      {
        time: [{ withinMinutes: 120, mode: 'amount', value: 50 }],
        sold: { basis: 'count', threshold: 4, mode: 'percent', value: -10 },
      },
    )
    assert.deepEqual(parseTierPriceRules({ time: null, sold: null }), {
      time: [],
      sold: null,
    })
  })
})

describe('priceRulesFromForm', () => {
  it('stores several time bands and one sold rule, skipping a blank row', () => {
    const form = new FormData()
    form.append('timeRuleWithinHours', '48')
    form.append('timeRuleMode', 'percent')
    form.append('timeRuleValue', '10')
    form.append('timeRuleWithinHours', '')
    form.append('timeRuleMode', 'amount')
    form.append('timeRuleValue', '')
    form.append('timeRuleWithinHours', '6')
    form.append('timeRuleMode', 'amount')
    form.append('timeRuleValue', '-500')
    form.set('soldRuleEnabled', '1')
    form.set('soldRuleBasis', 'count')
    form.set('soldRuleThreshold', '10')
    form.set('soldRuleMode', 'amount')
    form.set('soldRuleValue', '1000')
    assert.deepEqual(priceRulesFromForm(form), {
      time: [
        { withinMinutes: 48 * 60, mode: 'percent', value: 10 },
        { withinMinutes: 6 * 60, mode: 'amount', value: -500 },
      ],
      sold: { basis: 'count', threshold: 10, mode: 'amount', value: 1000 },
    })
  })
})

describe('parsePriceModifierInput', () => {
  it('treats a bare number as amount and a trailing % as percent', () => {
    assert.deepEqual(parsePriceModifierInput('500'), { mode: 'amount', value: 500 })
    assert.deepEqual(parsePriceModifierInput('-200'), { mode: 'amount', value: -200 })
    assert.deepEqual(parsePriceModifierInput('10%'), { mode: 'percent', value: 10 })
    assert.deepEqual(parsePriceModifierInput('-5 %'), { mode: 'percent', value: -5 })
    assert.equal(formatPriceModifierInput({ mode: 'percent', value: 10 }), '10%')
    assert.equal(formatPriceModifierInput({ mode: 'amount', value: 500 }), '500')
    assert.equal(formatPriceModifierInput({ mode: 'amount', value: 0 }), '')
  })
})

describe('sumFormPriceAddons', () => {
  it('sums selected option prices and a checked checkbox', () => {
    const total = sumFormPriceAddons(
      [
        {
          name: 'meal',
          type: 'select',
          options: [
            { value: 'none', priceAmount: 0 },
            { value: 'lunch', priceAmount: 2000 },
          ],
        },
        { name: 'shirt', type: 'checkbox', priceAmount: 3500 },
      ],
      { meal: 'lunch', shirt: 'on' },
    )
    assert.equal(total, 5500)
  })
})

describe('parseEventCurrency', () => {
  it('keeps a 3-letter code and drops anything else', () => {
    assert.equal(parseEventCurrency('huf'), 'HUF')
    assert.equal(parseEventCurrency('euro'), '')
    assert.equal(parseEventCurrency(''), '')
  })
})
