import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createDocumentLinksMemory } from './links'

describe('document links bind / list', () => {
  it('binds media-1 on (onboarding, report-1) and list returns that link (success path)', async () => {
    const mem = createDocumentLinksMemory({
      now: () => new Date('2026-11-28T12:00:00.000Z'),
      newId: (() => {
        let n = 0
        return () => `dlink-${++n}`
      })(),
    })

    const door = await mem.bindThroughDoor(true, true, {
      subjectKind: 'onboarding',
      subjectId: 'report-1',
      mediaId: 'media-1',
      title: 'Training report',
      createdBy: 'staff_1',
    })

    assert.equal(door.ok, true)
    if (!door.ok) return
    assert.equal(door.value.ok, true)
    if (!door.value.ok) return

    assert.equal(door.value.link.mediaId, 'media-1')
    assert.equal(door.value.link.subjectKind, 'onboarding')
    assert.equal(door.value.link.subjectId, 'report-1')
    assert.equal(mem.count(), 1)

    const listed = await mem.listThroughDoor(true, {
      subjectKind: 'onboarding',
      subjectId: 'report-1',
    })
    assert.equal(listed.ok, true)
    if (!listed.ok) return
    assert.equal(listed.value.length, 1)
    assert.equal(listed.value[0]?.mediaId, 'media-1')
    assert.equal(listed.value[0]?.id, door.value.link.id)
  })

  it('returns disabled without writing on pack off or authz failure; refuses page; isolates subjects (failure path)', async () => {
    const mem = createDocumentLinksMemory({
      newId: (() => {
        let n = 0
        return () => `dlink-f-${++n}`
      })(),
    })

    const packOff = await mem.bindThroughDoor(false, true, {
      subjectKind: 'onboarding',
      subjectId: 'report-1',
      mediaId: 'media-1',
      title: 'Should not write',
      createdBy: 'staff_1',
    })
    assert.deepEqual(packOff, { ok: false, reason: 'disabled' })
    assert.equal(mem.count(), 0)

    const authzFail = await mem.bindThroughDoor(true, false, {
      subjectKind: 'onboarding',
      subjectId: 'report-1',
      mediaId: 'media-1',
      title: 'Should not write',
      createdBy: 'staff_1',
    })
    assert.deepEqual(authzFail, { ok: false, reason: 'disabled' })
    assert.equal(mem.count(), 0)

    const pageRefused = await mem.bindThroughDoor(true, true, {
      subjectKind: 'page',
      subjectId: 'page-1',
      mediaId: 'media-1',
      title: 'Page file',
      createdBy: 'staff_1',
    })
    assert.equal(pageRefused.ok, true)
    if (!pageRefused.ok) return
    assert.equal(pageRefused.value.ok, false)
    assert.equal(mem.count(), 0)

    const success = await mem.bindThroughDoor(true, true, {
      subjectKind: 'onboarding',
      subjectId: 'report-1',
      mediaId: 'media-1',
      title: 'Training report',
      createdBy: 'staff_1',
    })
    assert.equal(success.ok, true)
    if (!success.ok || !success.value.ok) return
    assert.equal(mem.count(), 1)

    const otherSubject = await mem.listThroughDoor(true, {
      subjectKind: 'onboarding',
      subjectId: 'report-2',
    })
    assert.equal(otherSubject.ok, true)
    if (!otherSubject.ok) return
    assert.equal(otherSubject.value.length, 0)
    assert.ok(!otherSubject.value.some((row) => row.mediaId === 'media-1'))
  })
})
