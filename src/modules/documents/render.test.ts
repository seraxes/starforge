import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createDocumentRenderMemory } from './render'

function seedTrainingReportTemplate(
  mem: ReturnType<typeof createDocumentRenderMemory>,
) {
  mem.seedTemplate({
    id: 'training-report',
    title: 'Training report',
    subjectKind: 'onboarding',
    renderSource: 'values-pdf',
    enabled: true,
    createdAt: new Date('2026-11-28T10:00:00.000Z'),
    updatedAt: new Date('2026-11-28T10:00:00.000Z'),
  })
}

describe('document template render', () => {
  it('renders for (onboarding, report-1, training-report) and second render updates mediaId without a second file (success path)', async () => {
    const mem = createDocumentRenderMemory({
      now: () => new Date('2026-11-28T12:00:00.000Z'),
      newId: (() => {
        let n = 0
        return () => `dlink-${++n}`
      })(),
      newMediaId: (() => {
        let n = 0
        return () => `media-${++n}`
      })(),
    })
    seedTrainingReportTemplate(mem)

    const first = await mem.renderThroughDoor(true, true, {
      subjectKind: 'onboarding',
      subjectId: 'report-1',
      templateId: 'training-report',
      title: 'Training report',
      createdBy: 'staff_1',
      values: { trainee: 'user-a', passed: 'yes' },
    })

    assert.equal(first.ok, true)
    if (!first.ok) return
    assert.equal(first.value.ok, true)
    if (!first.value.ok) return

    assert.ok(first.value.mediaId)
    assert.equal(first.value.link.subjectKind, 'onboarding')
    assert.equal(first.value.link.subjectId, 'report-1')
    assert.equal(first.value.link.templateId, 'training-report')
    assert.equal(first.value.link.mediaId, first.value.mediaId)
    assert.equal(mem.linkCount(), 1)
    assert.equal(mem.mediaCount(), 1)

    const firstMediaId = first.value.mediaId
    const firstLinkId = first.value.link.id

    const second = await mem.renderThroughDoor(true, true, {
      subjectKind: 'onboarding',
      subjectId: 'report-1',
      templateId: 'training-report',
      title: 'Training report (updated)',
      createdBy: 'staff_1',
      values: { trainee: 'user-a', passed: 'no' },
    })

    assert.equal(second.ok, true)
    if (!second.ok) return
    assert.equal(second.value.ok, true)
    if (!second.value.ok) return

    assert.ok(second.value.mediaId)
    assert.equal(second.value.link.id, firstLinkId)
    assert.equal(second.value.link.mediaId, second.value.mediaId)
    assert.notEqual(second.value.mediaId, firstMediaId)
    assert.equal(mem.linkCount(), 1)
    assert.equal(mem.mediaCount(), 1)
  })

  it('returns disabled without writing on pack off or authz failure (failure path)', async () => {
    const mem = createDocumentRenderMemory({
      newId: (() => {
        let n = 0
        return () => `dlink-f-${++n}`
      })(),
      newMediaId: (() => {
        let n = 0
        return () => `media-f-${++n}`
      })(),
    })
    seedTrainingReportTemplate(mem)

    const packOff = await mem.renderThroughDoor(false, true, {
      subjectKind: 'onboarding',
      subjectId: 'report-1',
      templateId: 'training-report',
      title: 'Should not write',
      createdBy: 'staff_1',
      values: { trainee: 'user-a' },
    })
    assert.deepEqual(packOff, { ok: false, reason: 'disabled' })
    assert.equal(mem.linkCount(), 0)
    assert.equal(mem.mediaCount(), 0)

    const authzFail = await mem.renderThroughDoor(true, false, {
      subjectKind: 'onboarding',
      subjectId: 'report-1',
      templateId: 'training-report',
      title: 'Should not write',
      createdBy: 'staff_1',
      values: { trainee: 'user-a' },
    })
    assert.deepEqual(authzFail, { ok: false, reason: 'disabled' })
    assert.equal(mem.linkCount(), 0)
    assert.equal(mem.mediaCount(), 0)
  })
})
