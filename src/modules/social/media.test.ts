import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  POST_MEDIA_IMAGE_MAX,
  createPostMemory,
  createPostRecord,
  decidePostAttachments,
  resolveMediaForMember,
  type MediaResolveResult,
} from './posts'

const library = new Map<string, MediaResolveResult>([
  ['img-1', { mediaId: 'img-1', mimeType: 'image/jpeg' }],
  ['img-2', { mediaId: 'img-2', mimeType: 'image/png' }],
  ['img-3', { mediaId: 'img-3', mimeType: 'image/webp' }],
  ['img-other', { mediaId: 'img-other', mimeType: 'image/jpeg' }],
  ['vid-1', { mediaId: 'vid-1', mimeType: 'video/mp4' }],
  ['vid-2', { mediaId: 'vid-2', mimeType: 'video/webm' }],
  ['pdf-1', { mediaId: 'pdf-1', mimeType: 'application/pdf' }],
])

function resolveKnown(mediaId: string): MediaResolveResult | null {
  return library.get(mediaId.trim()) ?? null
}

/** Alice owns img-1..3 and vid-1; Media door will not read img-other for her. */
function resolveForAlice(mediaId: string): MediaResolveResult | null {
  return resolveMediaForMember(mediaId, {
    resolveMedia: resolveKnown,
    memberCanRead: (id) => id !== 'img-other',
  })
}

describe('post media attachments', () => {
  it('attaches many known images on a media post (success path)', () => {
    const memory = createPostMemory({
      newId: () => 'post-media-1',
      now: () => new Date('2026-11-19T18:00:00.000Z'),
      resolveMedia: resolveKnown,
    })
    const result = memory.create({
      authorUserId: 'alice',
      body: 'album',
      audience: 'friends',
      mediaIds: ['img-1', 'img-2', 'img-3'],
    })
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.post.kind, 'media')
    assert.equal(result.post.media.length, 3)
    assert.deepEqual(
      result.post.media.map((row) => row.mediaId),
      ['img-1', 'img-2', 'img-3'],
    )
    assert.equal(result.post.media.every((row) => row.role === 'attachment'), true)
    assert.equal(memory.get('post-media-1')?.media.length, 3)
  })

  it('attaches one known video without a caption (success path)', () => {
    const decided = decidePostAttachments(['vid-1'], resolveKnown)
    assert.equal(decided.ok, true)
    if (!decided.ok) return
    assert.equal(decided.attachments.length, 1)
    assert.equal(decided.attachments[0]?.mimeType, 'video/mp4')

    const result = createPostRecord(
      { authorUserId: 'alice', body: '', mediaIds: ['vid-1'] },
      { resolveMedia: resolveKnown, newId: () => 'post-vid-1' },
    )
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.post.kind, 'media')
    assert.equal(result.post.body, '')
    assert.equal(result.post.media[0]?.mediaId, 'vid-1')
  })

  it('refuses an unknown mediaId (failure path)', () => {
    assert.deepEqual(decidePostAttachments(['missing-id'], resolveKnown), {
      ok: false,
      reason: 'unknown_media',
    })
    assert.deepEqual(
      createPostRecord(
        {
          authorUserId: 'alice',
          body: 'hello',
          mediaIds: ['img-1', 'does-not-exist'],
        },
        { resolveMedia: resolveKnown },
      ),
      { ok: false, reason: 'unknown_media' },
    )
    assert.deepEqual(
      createPostRecord({
        authorUserId: 'alice',
        body: 'hello',
        mediaIds: ['img-1'],
      }),
      { ok: false, reason: 'unknown_media' },
    )
  })

  it('refuses an id the Media door will not read for this member (failure path)', () => {
    // Asset exists in the library, but the door returns null for this member.
    assert.equal(resolveKnown('img-other')?.mediaId, 'img-other')
    assert.equal(resolveForAlice('img-other'), null)
    assert.deepEqual(decidePostAttachments(['img-other'], resolveForAlice), {
      ok: false,
      reason: 'unknown_media',
    })
    assert.deepEqual(
      createPostRecord(
        {
          authorUserId: 'alice',
          body: 'hello',
          mediaIds: ['img-1', 'img-other'],
        },
        { resolveMedia: resolveForAlice },
      ),
      { ok: false, reason: 'unknown_media' },
    )
  })

  it('refuses 11 images (failure path)', () => {
    const eleven = Array.from({ length: POST_MEDIA_IMAGE_MAX + 1 }, (_, i) => {
      const id = `img-n-${i + 1}`
      library.set(id, { mediaId: id, mimeType: 'image/jpeg' })
      return id
    })
    assert.equal(eleven.length, 11)
    assert.deepEqual(decidePostAttachments(eleven, resolveKnown), {
      ok: false,
      reason: 'invalid_media_mix',
    })
    assert.deepEqual(
      createPostRecord(
        { authorUserId: 'alice', body: 'too many', mediaIds: eleven },
        { resolveMedia: resolveKnown },
      ),
      { ok: false, reason: 'invalid_media_mix' },
    )
  })

  it('refuses mixing images with a video (failure path)', () => {
    assert.deepEqual(
      decidePostAttachments(['img-1', 'vid-1'], resolveKnown),
      { ok: false, reason: 'invalid_media_mix' },
    )
    assert.deepEqual(
      decidePostAttachments(['vid-1', 'vid-2'], resolveKnown),
      { ok: false, reason: 'invalid_media_mix' },
    )
    assert.deepEqual(
      decidePostAttachments(['pdf-1'], resolveKnown),
      { ok: false, reason: 'invalid_media_mix' },
    )
  })
})
