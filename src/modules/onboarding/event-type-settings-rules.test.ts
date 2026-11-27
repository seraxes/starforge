import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  DEFAULT_EVENT_TYPE_SETTINGS,
  depotsAsStationCatalog,
  isEventOutcomeOpen,
  planPassedOutcomesForCompletedStatus,
  validateDepotFields,
} from './event-type-settings-rules'

const emptySettings = {
  ridealong: { ...DEFAULT_EVENT_TYPE_SETTINGS, completedStatusIds: [] as string[] },
  testday: { ...DEFAULT_EVENT_TYPE_SETTINGS, completedStatusIds: [] as string[] },
  trialday: { ...DEFAULT_EVENT_TYPE_SETTINGS, completedStatusIds: [] as string[] },
}

describe('onboarding depot fields', () => {
  it('refuses an empty depot name', () => {
    const refused = validateDepotFields({ name: '   ', address: '1 Main St' })
    assert.equal(refused.ok, false)
    if (refused.ok) return
    assert.match(refused.error, /name/i)
  })

  it('accepts a short name and address', () => {
    const ok = validateDepotFields({ name: 'North', address: '1 Depot Rd' })
    assert.equal(ok.ok, true)
    if (!ok.ok) return
    assert.equal(ok.values.name, 'North')
    assert.equal(ok.values.address, '1 Depot Rd')
  })
})

describe('onboarding completed status → passed outcome', () => {
  it('sets that event’s outcome to passed when the status is listed as completed', () => {
    const settings = {
      ...emptySettings,
      testday: {
        ...DEFAULT_EVENT_TYPE_SETTINGS,
        completedStatusIds: ['status_exam_done'],
      },
    }
    const plan = planPassedOutcomesForCompletedStatus({
      newStatusId: 'status_exam_done',
      eventTypeSettings: settings,
      openEvents: [
        { id: 'evt_open', kind: 'testday', outcome: '' },
        { id: 'evt_other', kind: 'ridealong', outcome: '' },
      ],
    })
    assert.deepEqual(plan.eventIds, ['evt_open'])
    assert.equal(plan.outcome, 'passed')
    assert.deepEqual(plan.kinds, ['testday'])
  })

  it('does not set failed or no_show', () => {
    const settings = {
      ...emptySettings,
      testday: {
        ...DEFAULT_EVENT_TYPE_SETTINGS,
        completedStatusIds: ['status_exam_done'],
      },
      trialday: {
        ...DEFAULT_EVENT_TYPE_SETTINGS,
        completedStatusIds: ['status_exam_done'],
      },
    }
    const plan = planPassedOutcomesForCompletedStatus({
      newStatusId: 'status_exam_done',
      eventTypeSettings: settings,
      openEvents: [
        { id: 'evt_a', kind: 'testday', outcome: 'email_sent' },
        { id: 'evt_b', kind: 'trialday', outcome: '' },
      ],
    })
    assert.equal(plan.outcome, 'passed')
    assert.notEqual(plan.outcome, 'failed')
    assert.notEqual(plan.outcome, 'no_show')
    assert.deepEqual(plan.eventIds.sort(), ['evt_a', 'evt_b'])
  })

  it('skips events that already have a terminal outcome', () => {
    const settings = {
      ...emptySettings,
      testday: {
        ...DEFAULT_EVENT_TYPE_SETTINGS,
        completedStatusIds: ['status_exam_done'],
      },
    }
    const plan = planPassedOutcomesForCompletedStatus({
      newStatusId: 'status_exam_done',
      eventTypeSettings: settings,
      openEvents: [
        { id: 'evt_failed', kind: 'testday', outcome: 'failed' },
        { id: 'evt_noshow', kind: 'testday', outcome: 'no_show' },
        { id: 'evt_open', kind: 'testday', outcome: '' },
      ],
    })
    assert.deepEqual(plan.eventIds, ['evt_open'])
    assert.equal(plan.outcome, 'passed')
  })

  it('does nothing when the new status is not a completed status', () => {
    const settings = {
      ...emptySettings,
      testday: {
        ...DEFAULT_EVENT_TYPE_SETTINGS,
        completedStatusIds: ['status_exam_done'],
      },
    }
    const plan = planPassedOutcomesForCompletedStatus({
      newStatusId: 'status_other',
      eventTypeSettings: settings,
      openEvents: [{ id: 'evt_open', kind: 'testday', outcome: '' }],
    })
    assert.deepEqual(plan.eventIds, [])
    assert.equal(plan.outcome, 'passed')
  })
})

describe('onboarding open event outcome', () => {
  it('treats blank and email_sent as open', () => {
    assert.equal(isEventOutcomeOpen(''), true)
    assert.equal(isEventOutcomeOpen('email_sent'), true)
    assert.equal(isEventOutcomeOpen('passed'), false)
    assert.equal(isEventOutcomeOpen('failed'), false)
    assert.equal(isEventOutcomeOpen('no_show'), false)
    assert.equal(isEventOutcomeOpen('completed'), false)
  })
})

describe('onboarding depots as station catalog', () => {
  it('maps depot name to the station label while Fleet is absent', () => {
    assert.deepEqual(
      depotsAsStationCatalog([
        { id: 'depot_1', name: 'North' },
        { id: 'depot_2', name: 'South' },
      ]),
      [
        { id: 'depot_1', label: 'North' },
        { id: 'depot_2', label: 'South' },
      ],
    )
  })
})
