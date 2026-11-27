import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  eventTypesForNewCard,
  planDeleteEventType,
  validateEventTypeFields,
} from './event-type-catalog-rules'

const taken = ['ridealong', 'testday', 'trialday', 'trainingday']

describe('onboarding event type catalog', () => {
  it('accepts a new type with a label and a unique key', () => {
    const ok = validateEventTypeFields(
      { label: 'Induction week', key: 'inductionweek' },
      undefined,
      taken,
    )
    assert.equal(ok.ok, true)
    if (!ok.ok) return
    assert.equal(ok.values.label, 'Induction week')
    assert.equal(ok.values.key, 'inductionweek')
    assert.equal(ok.values.enabled, true)
  })

  it('refuses an empty label', () => {
    const refused = validateEventTypeFields({ label: '   ', key: 'custom' }, undefined, taken)
    assert.equal(refused.ok, false)
    if (refused.ok) return
    assert.match(refused.error, /label/i)
  })

  it('refuses a duplicate key', () => {
    const refused = validateEventTypeFields(
      { label: 'Another ride', key: 'ridealong' },
      undefined,
      taken,
    )
    assert.equal(refused.ok, false)
    if (refused.ok) return
    assert.match(refused.error, /already in use/i)
  })

  it('refuses delete of a type that has a person card and keeps the type', () => {
    const refused = planDeleteEventType({ cardCount: 2 })
    assert.equal(refused.ok, false)
    if (refused.ok) return
    assert.equal(refused.kept, true)
    assert.match(refused.error, /person card/i)

    const allowed = planDeleteEventType({ cardCount: 0 })
    assert.equal(allowed.ok, true)
  })

  it('omits a deactivated type from the new-event kind list', () => {
    const list = eventTypesForNewCard([
      { key: 'ridealong', label: 'Ride-along', enabled: true },
      { key: 'inductionweek', label: 'Induction week', enabled: false },
      { key: 'trainingday', label: 'Training day', enabled: true },
    ])
    assert.deepEqual(
      list.map((row) => row.key),
      ['ridealong', 'trainingday'],
    )
  })
})
