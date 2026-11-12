import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  addBillingPeriod,
  billingPeriodDurationMs,
  computeUpgradeCreditMajor,
  periodEffectiveEnd,
  subtractBillingPeriod,
} from './lifecycle-math'
import type { SubscriptionPeriodRecord, SubscriptionPlanRecord } from './types'

function plan(partial: Partial<SubscriptionPlanRecord>): SubscriptionPlanRecord {
  return {
    id: 'splan_test',
    subject: 'membership',
    audience: '',
    title: 'Test',
    description: '',
    price: 100,
    billingPeriod: 'month',
    entitlementKeys: ['events.member'],
    groupIds: [],
    sourceModule: '',
    sourceType: '',
    sourceId: '',
    active: true,
    sortOrder: 0,
    trialDurationDays: 0,
    trialPrice: 0,
    trialOnce: true,
    lifetime: false,
    fixedExpiresAt: null,
    maxActive: 0,
    formDefinitionId: '',
    earlyRenewDays: 0,
    earlyRenewPrice: null,
    upgradeTargetIds: [],
    graceHours: 0,
    seatLimit: 0,
    recurringSupported: false,
    imageMediaId: '',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...partial,
  }
}

function period(partial: Partial<SubscriptionPeriodRecord>): SubscriptionPeriodRecord {
  return {
    id: 'speriod_test',
    planId: 'splan_test',
    userId: 'user_1',
    status: 'active',
    startsAt: new Date('2026-01-01T00:00:00.000Z'),
    endsAt: new Date('2026-02-01T00:00:00.000Z'),
    orderId: null,
    subject: 'membership',
    audience: '',
    billingPeriod: 'month',
    entitlementKeys: [],
    groupIds: [],
    sourceModule: '',
    sourceType: '',
    sourceId: '',
    source: 'purchase',
    cancelAtPeriodEnd: false,
    autoRenew: false,
    paymentsRecurringId: null,
    isTrial: false,
    parentPeriodId: null,
    seatRole: '',
    reminderExpiringSentAt: null,
    reminderTrialSentAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...partial,
  }
}

describe('subscription lifecycle helpers', () => {
  it('keeps access through grace after nominal endsAt', () => {
    const p = period({ endsAt: new Date('2026-02-01T00:00:00.000Z') })
    const effective = periodEffectiveEnd(p, 48)
    assert.equal(effective.getTime(), new Date('2026-02-03T00:00:00.000Z').getTime())
  })

  it('credits unused time against one billing period, not a stacked window', () => {
    const fromPlan = plan({ price: 100, billingPeriod: 'month' })
    // Near the end of a stacked renew window — stacked denominator under-credits.
    const now = new Date('2026-03-15T00:00:00.000Z')
    const fromPeriod = period({
      startsAt: new Date('2026-01-01T00:00:00.000Z'),
      endsAt: new Date('2026-04-01T00:00:00.000Z'),
      billingPeriod: 'month',
    })
    const stackedCredit = Math.floor(
      fromPlan.price *
        ((fromPeriod.endsAt.getTime() - now.getTime()) /
          (fromPeriod.endsAt.getTime() - fromPeriod.startsAt.getTime())),
    )
    const credit = computeUpgradeCreditMajor(fromPeriod, fromPlan, now)
    assert.ok(credit > stackedCredit)
    assert.ok(credit > 0)
    assert.ok(credit <= fromPlan.price)
  })

  it('subtracts one billing period for refund shrink', () => {
    const end = new Date('2026-04-01T00:00:00.000Z')
    const shrunk = subtractBillingPeriod(end, 'month')
    assert.equal(shrunk.getUTCMonth(), 2)
    const from = new Date('2026-01-01T00:00:00.000Z')
    const ms = billingPeriodDurationMs('month', from)
    assert.ok(ms > 0)
    assert.equal(addBillingPeriod(from, 'month').getTime() - from.getTime(), ms)
  })
})
