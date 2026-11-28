import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  isHomeFeedCandidate,
  selectHomeFeedPosts,
} from './feed'
import {
  canViewPost,
  createPostRecord,
  decideApprovePendingPost,
  decideRejectPendingPost,
  resolvePostPermalink,
  type CanViewPostContext,
} from './posts'

function viewCtx(
  overrides: Partial<CanViewPostContext> = {},
): CanViewPostContext {
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

describe('pending review queue', () => {
  it('holds a new post out of the home feed while the author and staff can still read it (success path)', () => {
    const created = createPostRecord(
      { authorUserId: 'alice', body: 'held', audience: 'public' },
      { holdForStaffReview: true, newId: () => 'held-1' },
    )
    assert.equal(created.ok, true)
    if (!created.ok) return
    assert.equal(created.post.pendingReview, true)
    assert.equal(created.post.staffHidden, false)

    assert.equal(
      canViewPost(created.post, viewCtx({ viewerUserId: 'alice' })),
      true,
    )
    assert.equal(
      canViewPost(
        created.post,
        viewCtx({ viewerUserId: 'mod', canManagePosts: true, areFriends: false }),
      ),
      true,
    )
    assert.equal(
      canViewPost(created.post, viewCtx({ viewerUserId: 'bob', areFriends: true })),
      false,
    )
    assert.deepEqual(
      resolvePostPermalink(
        created.post,
        viewCtx({ viewerUserId: 'carol', areFriends: false }),
      ),
      { ok: false, reason: 'not_found' },
    )

    const friendIds = new Set(['alice'])
    assert.equal(isHomeFeedCandidate(created.post, 'bob', friendIds), true)
    const visible = selectHomeFeedPosts(
      [created.post],
      'bob',
      friendIds,
      () => viewCtx({ viewerUserId: 'bob', areFriends: true }),
    )
    assert.equal(visible.length, 0)

    const approved = decideApprovePendingPost(
      created.post,
      { actorUserId: 'mod', postId: created.post.id },
      { canManagePosts: true },
      { now: new Date('2026-11-27T12:00:00.000Z') },
    )
    assert.equal(approved.ok, true)
    if (!approved.ok) return
    assert.equal(approved.post.pendingReview, false)
    assert.equal(approved.post.staffHidden, false)
    assert.equal(
      canViewPost(approved.post, viewCtx({ viewerUserId: 'bob', areFriends: true })),
      true,
    )
    assert.equal(
      selectHomeFeedPosts(
        [approved.post],
        'bob',
        friendIds,
        () => viewCtx({ viewerUserId: 'bob', areFriends: true }),
      ).length,
      1,
    )
  })

  it('rejects a held post into staff-hide and refuses approve without the grant (failure path)', () => {
    const created = createPostRecord(
      { authorUserId: 'alice', body: 'nope', audience: 'public' },
      { holdForStaffReview: true, newId: () => 'held-2' },
    )
    assert.equal(created.ok, true)
    if (!created.ok) return

    assert.deepEqual(
      decideApprovePendingPost(
        created.post,
        { actorUserId: 'bob', postId: created.post.id },
        { canManagePosts: false },
      ),
      { ok: false, reason: 'cannot_manage' },
    )

    const rejected = decideRejectPendingPost(
      created.post,
      { actorUserId: 'mod', postId: created.post.id },
      { canManagePosts: true },
      { now: new Date('2026-11-27T12:30:00.000Z') },
    )
    assert.equal(rejected.ok, true)
    if (!rejected.ok) return
    assert.equal(rejected.post.pendingReview, false)
    assert.equal(rejected.post.staffHidden, true)
    assert.equal(
      canViewPost(rejected.post, viewCtx({ viewerUserId: 'bob', areFriends: true })),
      false,
    )
    assert.equal(
      canViewPost(rejected.post, viewCtx({ viewerUserId: 'alice' })),
      true,
    )
    assert.deepEqual(
      decideApprovePendingPost(
        rejected.post,
        { actorUserId: 'mod', postId: rejected.post.id },
        { canManagePosts: true },
      ),
      { ok: false, reason: 'invalid' },
    )
  })
})
