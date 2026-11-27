import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createDocumentRenderMemory } from './render'
import { createDocumentSigningMemory } from './signing'

describe('document signature webhook / signed render', () => {
  it('signed webhook sets status signed and new mediaId; same event id does not insert a second file (success path)', async () => {
    const mem = createDocumentSigningMemory({
      now: () => new Date('2026-11-28T12:00:00.000Z'),
      newMediaId: (() => {
        let n = 0
        return () => `media-signed-${++n}`
      })(),
      newReceiptId: (() => {
        let n = 0
        return () => `receipt-${++n}`
      })(),
    })

    mem.seedMedia('media-unsigned')
    mem.seedLink({
      id: 'dlink-1',
      subjectKind: 'onboarding',
      subjectId: 'report-1',
      templateId: 'contract',
      mediaId: 'media-unsigned',
      title: 'Contract',
      status: 'sent',
      providerId: 'test',
      envelopeId: 'env-1',
      generation: 1,
      createdAt: new Date('2026-11-28T11:00:00.000Z'),
      createdBy: 'staff_1',
    })

    const first = await mem.webhookThroughDoor(true, true, {
      providerId: 'test',
      providerEventId: 'evt-1',
      envelopeId: 'env-1',
      status: 'signed',
    })

    assert.equal(first.ok, true)
    if (!first.ok) return
    assert.equal(first.value.ok, true)
    if (!first.value.ok) return

    assert.equal(first.value.replay, false)
    assert.equal(first.value.link.status, 'signed')
    assert.equal(first.value.link.mediaId, 'media-signed-1')
    assert.notEqual(first.value.link.mediaId, 'media-unsigned')
    assert.equal(first.value.receipt.providerEventId, 'evt-1')
    assert.equal(first.value.receipt.mediaId, 'media-signed-1')
    assert.equal(mem.linkCount(), 1)
    assert.equal(mem.receiptCount(), 1)
    assert.equal(mem.mediaCount(), 2)

    const replay = await mem.webhookThroughDoor(true, true, {
      providerId: 'test',
      providerEventId: 'evt-1',
      envelopeId: 'env-1',
      status: 'signed',
    })

    assert.equal(replay.ok, true)
    if (!replay.ok) return
    assert.equal(replay.value.ok, true)
    if (!replay.value.ok) return

    assert.equal(replay.value.replay, true)
    assert.equal(replay.value.link.mediaId, 'media-signed-1')
    assert.equal(replay.value.link.status, 'signed')
    assert.equal(mem.linkCount(), 1)
    assert.equal(mem.receiptCount(), 1)
    assert.equal(mem.mediaCount(), 2)
  })

  it('render on a signed link leaves mediaId in place; pack off or authz failure returns disabled (failure path)', async () => {
    const renderMem = createDocumentRenderMemory({
      now: () => new Date('2026-11-28T12:00:00.000Z'),
      newId: (() => {
        let n = 0
        return () => `dlink-r-${++n}`
      })(),
      newMediaId: (() => {
        let n = 0
        return () => `media-r-${++n}`
      })(),
    })
    renderMem.seedTemplate({
      id: 'contract',
      title: 'Contract',
      subjectKind: 'onboarding',
      renderSource: 'values-pdf',
      enabled: true,
      createdAt: new Date('2026-11-28T10:00:00.000Z'),
      updatedAt: new Date('2026-11-28T10:00:00.000Z'),
    })
    renderMem.bag.links.set('dlink-signed', {
      id: 'dlink-signed',
      subjectKind: 'onboarding',
      subjectId: 'report-1',
      templateId: 'contract',
      mediaId: 'media-signed-keep',
      title: 'Contract',
      status: 'signed',
      providerId: 'test',
      envelopeId: 'env-keep',
      generation: 1,
      createdAt: new Date('2026-11-28T11:00:00.000Z'),
      createdBy: 'staff_1',
    })
    renderMem.bag.media.files.set(
      'media-signed-keep',
      Buffer.from('%PDF-1.4 keep\n', 'utf8'),
    )

    const refused = await renderMem.renderThroughDoor(true, true, {
      subjectKind: 'onboarding',
      subjectId: 'report-1',
      templateId: 'contract',
      title: 'Should not overwrite',
      createdBy: 'staff_1',
      values: { name: 'x' },
    })
    assert.equal(refused.ok, true)
    if (!refused.ok) return
    assert.equal(refused.value.ok, false)
    if (refused.value.ok) return
    assert.match(refused.value.error, /signed/i)

    const kept = renderMem.bag.links.get('dlink-signed')
    assert.ok(kept)
    assert.equal(kept.mediaId, 'media-signed-keep')
    assert.equal(kept.status, 'signed')
    assert.equal(renderMem.linkCount(), 1)
    assert.equal(renderMem.mediaCount(), 1)

    const signMem = createDocumentSigningMemory({
      newMediaId: (() => {
        let n = 0
        return () => `media-f-${++n}`
      })(),
    })
    signMem.seedMedia('media-unsigned')
    signMem.seedLink({
      id: 'dlink-f',
      subjectKind: 'onboarding',
      subjectId: 'report-1',
      templateId: 'contract',
      mediaId: 'media-unsigned',
      title: 'Contract',
      status: 'sent',
      providerId: 'test',
      envelopeId: 'env-f',
      generation: 1,
      createdAt: new Date('2026-11-28T11:00:00.000Z'),
      createdBy: 'staff_1',
    })

    const packOff = await signMem.webhookThroughDoor(false, true, {
      providerId: 'test',
      providerEventId: 'evt-off',
      envelopeId: 'env-f',
      status: 'signed',
    })
    assert.deepEqual(packOff, { ok: false, reason: 'disabled' })
    assert.equal(signMem.receiptCount(), 0)
    assert.equal(signMem.bag.links.get('dlink-f')?.mediaId, 'media-unsigned')
    assert.equal(signMem.bag.links.get('dlink-f')?.status, 'sent')

    const authzFail = await signMem.webhookThroughDoor(true, false, {
      providerId: 'test',
      providerEventId: 'evt-authz',
      envelopeId: 'env-f',
      status: 'signed',
    })
    assert.deepEqual(authzFail, { ok: false, reason: 'disabled' })
    assert.equal(signMem.receiptCount(), 0)
    assert.equal(signMem.bag.links.get('dlink-f')?.mediaId, 'media-unsigned')
    assert.equal(signMem.bag.links.get('dlink-f')?.status, 'sent')
  })
})
