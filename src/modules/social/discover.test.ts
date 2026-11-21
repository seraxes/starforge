import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  isDiscoverFeedCandidate,
  selectDiscoverFeedPage,
} from './discover'
import {
  createPostRecord,
  isReservedFeedHandle,
  type CanViewPostContext,
  type PostRecord,
} from './posts'

function viewCtx(overrides: Partial<CanViewPostContext> = {}): CanViewPostContext {
  return {
    viewerUserId: 'bob',
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

function makePost(
  authorUserId: string,
  audience: 'public' | 'friends' | 'only_me',
  body: string,
): PostRecord {
  const created = createPostRecord({
    authorUserId,
    body,
    audience,
  })
  assert.equal(created.ok, true)
  if (!created.ok) throw new Error('expected post')
  return created.post
}

describe('discover', () => {
  it('lists public posts on Discover (success path)', () => {
    const publicPost = makePost('alice', 'public', 'hello discover')
    const strangerPublic = makePost('carol', 'public', 'also public')

    assert.equal(isDiscoverFeedCandidate(publicPost), true)
    assert.equal(isDiscoverFeedCandidate(strangerPublic), true)

    const feed = selectDiscoverFeedPage(
      [strangerPublic, publicPost],
      () => viewCtx({ viewerUserId: 'bob', areFriends: false }),
      50,
    )
    assert.equal(feed.length, 2)
    assert.equal(feed[0]!.id, strangerPublic.id)
    assert.equal(feed[1]!.id, publicPost.id)

    // Blocked author is omitted via canViewPost.
    const blockedOut = selectDiscoverFeedPage(
      [publicPost],
      () =>
        viewCtx({
          viewerUserId: 'bob',
          isBlocked: true,
        }),
      50,
    )
    assert.equal(blockedOut.length, 0)

    assert.equal(isReservedFeedHandle('discover'), true)
  })

  it('omits a friends-only post from Discover (failure path)', () => {
    const publicPost = makePost('alice', 'public', 'visible')
    const friendsOnly = makePost('alice', 'friends', 'friends only')

    assert.equal(isDiscoverFeedCandidate(friendsOnly), false)
    assert.equal(isDiscoverFeedCandidate(publicPost), true)

    const feed = selectDiscoverFeedPage(
      [friendsOnly, publicPost],
      () =>
        viewCtx({
          viewerUserId: 'bob',
          // Even when friends, friends-only is not a discover candidate.
          areFriends: true,
        }),
      50,
    )
    assert.equal(feed.length, 1)
    assert.equal(feed[0]!.id, publicPost.id)
    assert.equal(
      feed.some((p) => p.id === friendsOnly.id),
      false,
    )
  })
})
