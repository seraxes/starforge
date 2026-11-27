import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  isOutcomeAllowedForKind,
  outcomesForEventKind,
  statusIdAfterEventOutcome,
  validateEventFields,
  validateInviteFields,
} from './procedure-rules'

describe('onboarding event outcomes', () => {
  it('allows email_sent / completed / no_show on ride-along', () => {
    assert.deepEqual(outcomesForEventKind('ridealong'), [
      'email_sent',
      'completed',
      'no_show',
    ])
    assert.equal(isOutcomeAllowedForKind('ridealong', 'completed'), true)
    assert.equal(isOutcomeAllowedForKind('ridealong', 'passed'), false)
  })

  it('allows email_sent / passed / failed / no_show on trial day and test day', () => {
    for (const kind of ['trialday', 'testday'] as const) {
      assert.deepEqual(outcomesForEventKind(kind), [
        'email_sent',
        'passed',
        'failed',
        'no_show',
      ])
      assert.equal(isOutcomeAllowedForKind(kind, 'passed'), true)
      assert.equal(isOutcomeAllowedForKind(kind, 'completed'), false)
    }
  })

  it('does not change the person status id when an outcome is applied', () => {
    const before = 'status_recruiting'
    assert.equal(statusIdAfterEventOutcome(before, 'completed'), before)
    assert.equal(statusIdAfterEventOutcome(before, 'passed'), before)
    assert.equal(statusIdAfterEventOutcome(before, 'no_show'), before)
    assert.equal(statusIdAfterEventOutcome(before, 'email_sent'), before)
  })
})

describe('onboarding event fields', () => {
  it('accepts a ridealong card with meeting mode', () => {
    const ok = validateEventFields({
      kind: 'ridealong',
      location: 'Depot A',
      meetingMode: 'onsite',
      applicantResponse: 'attending',
    })
    assert.equal(ok.ok, true)
    if (!ok.ok) return
    assert.equal(ok.values.kind, 'ridealong')
    assert.equal(ok.values.meetingMode, 'onsite')
    assert.equal(ok.values.applicantResponse, 'attending')
  })

  it('refuses an unknown kind', () => {
    const bad = validateEventFields({ kind: 'party' })
    assert.equal(bad.ok, false)
    if (bad.ok) return
    assert.match(bad.error, /kind/i)
  })
})

describe('onboarding invite fields', () => {
  it('accepts name and email', () => {
    const ok = validateInviteFields({ name: 'Ada', email: 'Ada@Example.TEST' })
    assert.equal(ok.ok, true)
    if (!ok.ok) return
    assert.equal(ok.values.email, 'ada@example.test')
  })

  it('refuses a blank email', () => {
    const bad = validateInviteFields({ name: 'Ada', email: 'not-an-email' })
    assert.equal(bad.ok, false)
  })
})
