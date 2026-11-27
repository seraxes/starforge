import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  emptyTrainingChecklist,
  planQualificationOnChecklistPass,
  planQualificationOnQuizResult,
  statusIdAfterTrainingPass,
  validateTrainerSlotIndex,
  validateTrainingChecklist,
  validateTrainingReportFields,
} from './training-rules'

describe('onboarding training checklist', () => {
  it('refuses a checklist that is not 14 sections', () => {
    const short = validateTrainingChecklist([{ key: 's01', level: 'shown', note: '' }])
    assert.equal(short.ok, false)
    if (short.ok) return
    assert.match(short.error, /14/)

    const empty = validateTrainingChecklist([])
    assert.equal(empty.ok, false)

    const fifteen = validateTrainingChecklist(
      Array.from({ length: 15 }, (_, i) => ({
        key: `s${String(i + 1).padStart(2, '0')}`,
        level: 'shown',
        note: '',
      })),
    )
    assert.equal(fifteen.ok, false)
  })

  it('accepts exactly 14 sections', () => {
    const ok = validateTrainingChecklist(emptyTrainingChecklist())
    assert.equal(ok.ok, true)
    if (!ok.ok) return
    assert.equal(ok.sections.length, 14)
  })
})

describe('onboarding training qualification', () => {
  it('creates a qualification on checklist pass and leaves status unchanged', () => {
    const before = 'status_recruiting'
    const plan = planQualificationOnChecklistPass({
      statusId: before,
      passed: 'yes',
      reportDate: '2026-11-27',
      hasQualificationForSource: false,
    })
    assert.equal(plan.createQualification, true)
    assert.equal(plan.source, 'checklist')
    assert.equal(plan.qualifiedDate, '2026-11-27')
    assert.equal(plan.statusId, before)
    assert.equal(statusIdAfterTrainingPass(before), before)

    const second = planQualificationOnChecklistPass({
      statusId: before,
      passed: 'yes',
      reportDate: '2026-11-28',
      hasQualificationForSource: true,
    })
    assert.equal(second.createQualification, false)
    assert.equal(second.statusId, before)
  })

  it('does not create a qualification on quiz fail', () => {
    const before = 'status_recruiting'
    const plan = planQualificationOnQuizResult({
      statusId: before,
      passed: false,
      hasQualificationForSource: false,
    })
    assert.equal(plan.createQualification, false)
    assert.equal(plan.source, 'quiz')
    assert.equal(plan.statusId, before)
  })

  it('creates a qualification on quiz pass once', () => {
    const before = 'status_active'
    const plan = planQualificationOnQuizResult({
      statusId: before,
      passed: true,
      qualifiedDate: '2026-11-27',
      hasQualificationForSource: false,
    })
    assert.equal(plan.createQualification, true)
    assert.equal(plan.statusId, before)
  })
})

describe('onboarding trainer slot index', () => {
  it('refuses a trainer slot index above 3', () => {
    const four = validateTrainerSlotIndex(4)
    assert.equal(four.ok, false)
    if (four.ok) return
    assert.match(four.error, /1 and 3|between 1/i)

    const five = validateTrainerSlotIndex('5')
    assert.equal(five.ok, false)

    const zero = validateTrainerSlotIndex(0)
    assert.equal(zero.ok, false)
  })

  it('accepts slot indexes 1–3', () => {
    for (const n of [1, 2, 3]) {
      const ok = validateTrainerSlotIndex(n)
      assert.equal(ok.ok, true)
      if (!ok.ok) return
      assert.equal(ok.slotIndex, n)
    }
  })
})

describe('onboarding training report fields', () => {
  it('requires trainee and a 14-section checklist', () => {
    const bad = validateTrainingReportFields({
      traineeUserId: '',
      checklist: emptyTrainingChecklist(),
    })
    assert.equal(bad.ok, false)

    const ok = validateTrainingReportFields({
      traineeUserId: 'user_trainee',
      instructorUserId: 'user_instructor',
      reportDate: '2026-11-27',
      status: 'open',
      passed: 'yes',
      checklist: emptyTrainingChecklist(),
    })
    assert.equal(ok.ok, true)
    if (!ok.ok) return
    assert.equal(ok.values.passed, 'yes')
    assert.equal(ok.values.checklist.length, 14)
  })
})
