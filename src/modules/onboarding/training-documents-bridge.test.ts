import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  ONBOARDING_TRAINING_REPORT_SUBJECT_KIND,
  ONBOARDING_TRAINING_REPORT_TEMPLATE_ID,
  buildTrainingReportDocumentValues,
  resolveTrainingReportMediaId,
  type TrainingDocumentsRenderInput,
  type TrainingReportDocumentValuesInput,
} from './training-documents-bridge'

const report: TrainingReportDocumentValuesInput = {
  id: 'report-1',
  traineeUserId: 'trainee-1',
  instructorUserId: 'instructor-1',
  reportDate: '2026-11-28',
  depotKey: 'bud',
  depotLabel: 'Budapest',
  trainingDay: 'day-1',
  plate: 'ABC-123',
  rounds: 2,
  drove: true,
  status: 'open',
  passed: 'yes',
  note: 'Good run',
}

describe('onboarding training documents bridge', () => {
  it('Documents on returns a mediaId for the report to store (success path)', async () => {
    let packLocalCalls = 0
    let documentsCalls = 0
    let captured: TrainingDocumentsRenderInput | null = null

    const result = await resolveTrainingReportMediaId(
      { documentsEnabled: true },
      {
        report,
        authorized: true,
        createdBy: 'staff_1',
        title: 'Training report',
      },
      {
        renderViaDocuments: async (args) => {
          documentsCalls += 1
          captured = args
          return { ok: true, value: { ok: true, mediaId: 'media-docs-1' } }
        },
        renderPackLocal: async () => {
          packLocalCalls += 1
          return 'media-pack-should-not-run'
        },
      },
    )

    assert.deepEqual(result, {
      action: 'store',
      mediaId: 'media-docs-1',
      source: 'documents',
    })
    assert.equal(documentsCalls, 1)
    assert.equal(packLocalCalls, 0)
    assert.ok(captured)
    assert.equal(captured.subjectKind, ONBOARDING_TRAINING_REPORT_SUBJECT_KIND)
    assert.equal(captured.subjectId, 'report-1')
    assert.equal(captured.templateId, ONBOARDING_TRAINING_REPORT_TEMPLATE_ID)
    assert.equal(captured.authorized, true)
    assert.deepEqual(captured.values, buildTrainingReportDocumentValues(report))
  })

  it('Documents off stores a pack-local mediaId; authz disabled leaves mediaId and skips pack-local (failure path)', async () => {
    let packLocalCalls = 0
    const off = await resolveTrainingReportMediaId(
      { documentsEnabled: false },
      {
        report,
        authorized: true,
        createdBy: 'staff_1',
      },
      {
        renderViaDocuments: async () => {
          throw new Error('Documents door must not run when pack is off')
        },
        renderPackLocal: async () => {
          packLocalCalls += 1
          return 'media-pack-1'
        },
      },
    )
    assert.deepEqual(off, {
      action: 'store',
      mediaId: 'media-pack-1',
      source: 'pack_local',
    })
    assert.equal(packLocalCalls, 1)

    let packLocalOnAuthz = 0
    let documentsOnAuthz = 0
    const authz = await resolveTrainingReportMediaId(
      { documentsEnabled: true },
      {
        report,
        authorized: false,
        createdBy: 'staff_1',
      },
      {
        renderViaDocuments: async (args) => {
          documentsOnAuthz += 1
          assert.equal(args.authorized, false)
          return { ok: false, reason: 'disabled' }
        },
        renderPackLocal: async () => {
          packLocalOnAuthz += 1
          return 'media-pack-should-not-run'
        },
      },
    )
    assert.deepEqual(authz, { action: 'leave_unchanged' })
    assert.equal(documentsOnAuthz, 1)
    assert.equal(packLocalOnAuthz, 0)
  })
})
