import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  isHomeFeedCandidate,
  selectHomeFeedPosts,
} from './feed'
import {
  createPostMemory,
  createPostRecord,
  type CanViewPostContext,
} from './posts'

function baseCtx(overrides: Partial<CanViewPostContext> = {}): CanViewPostContext {
  return {
    viewerUserId: 'alice',
    areFriends: false,
    isBlocked: false,
    authorHidden: false,
    isGroupMember: false,
    isPageLiker: false,
    isPageAdmin: false,
    canManagePosts: false,
    ...overrides,
  }
}

describe('feed composer createPostRecord', () => {
  it('creates a text post with a non-empty body (success path)', () => {
    const memory = createPostMemory({
      newId: () => 'post-feed-1',
      now: () => new Date('2026-11-19T15:00:00.000Z'),
    })
    const result = memory.create({
      authorUserId: 'alice',
      body: 'Hello friends',
      audience: 'friends',
    })
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.post.body, 'Hello friends')
    assert.equal(result.post.audience, 'friends')
    assert.equal(memory.get('post-feed-1')?.body, 'Hello friends')
  })

  it('refuses an empty post (failure path)', () => {
    assert.deepEqual(
      createPostRecord({ authorUserId: 'alice', body: '' }),
      { ok: false, reason: 'empty_body' },
    )
    assert.deepEqual(
      createPostRecord({ authorUserId: 'alice', body: '   ' }),
      { ok: false, reason: 'empty_body' },
    )
    assert.deepEqual(
      createPostRecord({ authorUserId: 'alice', body: '<p></p>' }),
      { ok: false, reason: 'empty_body' },
    )
    assert.deepEqual(
      createPostRecord({ authorUserId: 'alice' }),
      { ok: false, reason: 'empty_body' },
    )
  })
})

describe('home feed selection', () => {
  it('includes own and friends posts the viewer may see (success path)', () => {
    const own = createPostRecord({
      authorUserId: 'alice',
      body: 'mine',
      audience: 'only_me',
    })
    const friendPost = createPostRecord({
      authorUserId: 'bob',
      body: 'hi',
      audience: 'friends',
    })
    assert.equal(own.ok, true)
    assert.equal(friendPost.ok, true)
    if (!own.ok || !friendPost.ok) return

    const friendIds = new Set(['bob'])
    assert.equal(isHomeFeedCandidate(own.post, 'alice', friendIds), true)
    assert.equal(isHomeFeedCandidate(friendPost.post, 'alice', friendIds), true)

    const visible = selectHomeFeedPosts(
      [own.post, friendPost.post],
      'alice',
      friendIds,
      (post) =>
        baseCtx({
          viewerUserId: 'alice',
          areFriends: post.authorUserId === 'bob',
        }),
    )
    assert.equal(visible.length, 2)
  })

  it('omits a non-friend friends-audience post (failure path)', () => {
    const stranger = createPostRecord({
      authorUserId: 'carol',
      body: 'secret-ish',
      audience: 'friends',
    })
    assert.equal(stranger.ok, true)
    if (!stranger.ok) return

    assert.equal(
      isHomeFeedCandidate(stranger.post, 'alice', new Set(['bob'])),
      false,
    )
  })
})
