import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  createPostRecord,
  isReservedFeedHandle,
  type CanViewPostContext,
  type MediaResolveResult,
  type PostRecord,
} from './posts'
import {
  DEFAULT_FEED_LAYOUT_MODE,
  FEED_LAYOUT_MODES,
  isShortVideoLayoutCandidate,
  resolveFeedLayoutMode,
  selectShortVideoLayoutPage,
} from './short-video'

const library = new Map<string, MediaResolveResult>([
  ['vid-1', { mediaId: 'vid-1', mimeType: 'video/mp4' }],
  ['vid-2', { mediaId: 'vid-2', mimeType: 'video/webm' }],
  ['img-1', { mediaId: 'img-1', mimeType: 'image/jpeg' }],
])

function resolveKnown(mediaId: string): MediaResolveResult | null {
  return library.get(mediaId.trim()) ?? null
}

function viewCtx(overrides: Partial<CanViewPostContext> = {}): CanViewPostContext {
  return {
    viewerUserId: 'bob',
    areFriends: true,
    isBlocked: false,
    authorHidden: false,
    isGroupMember: false,
    isPageLiker: false,
    isPageAdmin: false,
    canManagePosts: false,
    ...overrides,
  }
}

function makeVideoPost(authorUserId: string, mediaId = 'vid-1'): PostRecord {
  const created = createPostRecord(
    {
      authorUserId,
      body: '',
      audience: 'friends',
      mediaIds: [mediaId],
    },
    { resolveMedia: resolveKnown },
  )
  assert.equal(created.ok, true)
  if (!created.ok) throw new Error('expected video post')
  return created.post
}

function makeTextPost(authorUserId: string, body = 'hello'): PostRecord {
  const created = createPostRecord({
    authorUserId,
    body,
    audience: 'friends',
  })
  assert.equal(created.ok, true)
  if (!created.ok) throw new Error('expected text post')
  return created.post
}

function makeImagePost(authorUserId: string): PostRecord {
  const created = createPostRecord(
    {
      authorUserId,
      body: 'pics',
      audience: 'friends',
      mediaIds: ['img-1'],
    },
    { resolveMedia: resolveKnown },
  )
  assert.equal(created.ok, true)
  if (!created.ok) throw new Error('expected image post')
  return created.post
}

describe('short-video layout', () => {
  it('lists a single-video media post in short-video layout (success path)', () => {
    assert.deepEqual([...FEED_LAYOUT_MODES], ['timeline', 'short_video'])
    assert.equal(DEFAULT_FEED_LAYOUT_MODE, 'timeline')
    assert.deepEqual(resolveFeedLayoutMode(null), {
      ok: true,
      mode: 'timeline',
    })
    assert.deepEqual(resolveFeedLayoutMode('short_video'), {
      ok: true,
      mode: 'short_video',
    })

    const video = makeVideoPost('alice', 'vid-1')
    const otherVideo = makeVideoPost('carol', 'vid-2')

    assert.equal(isShortVideoLayoutCandidate(video), true)
    assert.equal(isShortVideoLayoutCandidate(otherVideo), true)

    const feed = selectShortVideoLayoutPage(
      [otherVideo, video],
      () => viewCtx({ viewerUserId: 'bob', areFriends: true }),
      50,
    )
    assert.equal(feed.length, 2)
    assert.equal(feed[0]!.id, otherVideo.id)
    assert.equal(feed[1]!.id, video.id)

    // Blocked author is omitted via canViewPost.
    const blockedOut = selectShortVideoLayoutPage(
      [video],
      () =>
        viewCtx({
          viewerUserId: 'bob',
          isBlocked: true,
        }),
      50,
    )
    assert.equal(blockedOut.length, 0)

    assert.equal(isReservedFeedHandle('watch'), true)
  })

  it('omits a non-video post from short-video layout (failure path)', () => {
    const video = makeVideoPost('alice')
    const textOnly = makeTextPost('alice', 'no video')
    const imagesOnly = makeImagePost('alice')

    assert.equal(isShortVideoLayoutCandidate(textOnly), false)
    assert.equal(isShortVideoLayoutCandidate(imagesOnly), false)
    assert.equal(isShortVideoLayoutCandidate(video), true)

    const feed = selectShortVideoLayoutPage(
      [textOnly, imagesOnly, video],
      () => viewCtx({ viewerUserId: 'bob', areFriends: true }),
      50,
    )
    assert.equal(feed.length, 1)
    assert.equal(feed[0]!.id, video.id)
    assert.equal(
      feed.some((p) => p.id === textOnly.id || p.id === imagesOnly.id),
      false,
    )

    assert.deepEqual(resolveFeedLayoutMode('reels'), {
      ok: false,
      reason: 'invalid_layout',
    })
  })
})
