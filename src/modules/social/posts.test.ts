import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  canViewPost,
  createPostMemory,
  createPostRecord,
  isReservedFeedHandle,
  memberFeedHref,
  resolvePostPermalink,
  type CanViewPostContext,
  type PostRecord,
} from './posts'

function baseCtx(overrides: Partial<CanViewPostContext> = {}): CanViewPostContext {
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

function textPost(
  overrides: Partial<PostRecord> & Pick<PostRecord, 'audience'>,
): PostRecord {
  const created = createPostRecord({
    authorUserId: 'alice',
    body: 'hello',
    audience: overrides.audience,
    groupId: overrides.groupId,
    pageId: overrides.pageId,
  })
  assert.equal(created.ok, true)
  if (!created.ok) throw new Error('expected post')
  return { ...created.post, ...overrides }
}

describe('posts canViewPost', () => {
  it('only me: author sees the post (success path)', () => {
    const post = textPost({ audience: 'only_me' })
    assert.equal(
      canViewPost(post, baseCtx({ viewerUserId: 'alice' })),
      true,
    )
  })

  it('only me: a non-author cannot see the post (failure path)', () => {
    const post = textPost({ audience: 'only_me' })
    assert.equal(canViewPost(post, baseCtx({ viewerUserId: 'bob' })), false)
    assert.deepEqual(
      resolvePostPermalink(post, baseCtx({ viewerUserId: 'bob' })),
      { ok: false, reason: 'not_found' },
    )
  })

  it('group: a member can see the post (success path)', () => {
    const post = textPost({ audience: 'group', groupId: 'g1' })
    assert.equal(
      canViewPost(
        post,
        baseCtx({ viewerUserId: 'bob', isGroupMember: true }),
      ),
      true,
    )
  })

  it('group and non-member: a non-member cannot see the post (failure path)', () => {
    const post = textPost({ audience: 'group', groupId: 'g1' })
    assert.equal(
      canViewPost(
        post,
        baseCtx({ viewerUserId: 'bob', isGroupMember: false }),
      ),
      false,
    )
    assert.deepEqual(
      resolvePostPermalink(
        post,
        baseCtx({ viewerUserId: 'bob', isGroupMember: false }),
      ),
      { ok: false, reason: 'not_found' },
    )
  })

  it('friends: an accepted friend can see the post (success path)', () => {
    const post = textPost({ audience: 'friends' })
    assert.equal(
      canViewPost(
        post,
        baseCtx({ viewerUserId: 'bob', areFriends: true }),
      ),
      true,
    )
  })

  it('friends: a non-friend cannot see the post (failure path)', () => {
    const post = textPost({ audience: 'friends' })
    assert.equal(
      canViewPost(
        post,
        baseCtx({ viewerUserId: 'bob', areFriends: false }),
      ),
      false,
    )
  })

  it('staff grant: sees another member only_me and friends-only posts (success path)', () => {
    const onlyMe = textPost({ audience: 'only_me' })
    const friendsOnly = textPost({ audience: 'friends' })
    const staff = baseCtx({
      viewerUserId: 'bob',
      areFriends: false,
      canManagePosts: true,
    })
    assert.equal(canViewPost(onlyMe, staff), true)
    assert.equal(canViewPost(friendsOnly, staff), true)
  })

  it('normal member without staff grant: sees neither only_me nor friends-only (failure path)', () => {
    const onlyMe = textPost({ audience: 'only_me' })
    const friendsOnly = textPost({ audience: 'friends' })
    const member = baseCtx({
      viewerUserId: 'bob',
      areFriends: false,
      canManagePosts: false,
    })
    assert.equal(canViewPost(onlyMe, member), false)
    assert.equal(canViewPost(friendsOnly, member), false)
  })

  it('public: anyone can see the post (success path)', () => {
    const post = textPost({ audience: 'public' })
    assert.equal(canViewPost(post, baseCtx({ viewerUserId: null })), true)
    assert.equal(canViewPost(post, baseCtx({ viewerUserId: 'carol' })), true)
  })

  it('block: a blocked viewer cannot see the post (failure path)', () => {
    const post = textPost({ audience: 'public' })
    assert.equal(
      canViewPost(
        post,
        baseCtx({
          viewerUserId: 'bob',
          areFriends: true,
          isBlocked: true,
        }),
      ),
      false,
    )
    assert.deepEqual(
      resolvePostPermalink(
        post,
        baseCtx({ viewerUserId: 'bob', isBlocked: true }),
      ),
      { ok: false, reason: 'not_found' },
    )
  })

  it('hidden author: a viewer cannot see the post (failure path)', () => {
    const post = textPost({ audience: 'public' })
    assert.equal(
      canViewPost(
        post,
        baseCtx({ viewerUserId: 'bob', authorHidden: true }),
      ),
      false,
    )
    assert.equal(
      canViewPost(
        post,
        baseCtx({ viewerUserId: 'alice', authorHidden: true }),
      ),
      true,
    )
  })
})

describe('posts create and reserved handles', () => {
  it('creates a text post with default friends audience', () => {
    const memory = createPostMemory({
      newId: () => 'post-1',
      now: () => new Date('2026-11-19T12:00:00.000Z'),
    })
    const result = memory.create({ authorUserId: 'alice', body: 'hi' })
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.post.audience, 'friends')
    assert.equal(result.post.kind, 'text')
    assert.equal(memory.get('post-1')?.body, 'hi')
  })

  it('refuses a group audience without groupId (failure path)', () => {
    const result = createPostRecord({
      authorUserId: 'alice',
      audience: 'group',
      body: 'wall',
    })
    assert.deepEqual(result, { ok: false, reason: 'group_required' })
  })

  it('permalink returns not-found when the post is missing', () => {
    assert.deepEqual(
      resolvePostPermalink(null, baseCtx()),
      { ok: false, reason: 'not_found' },
    )
  })

  it('routes reserved handles through /feed/u/[handle]', () => {
    assert.equal(isReservedFeedHandle('people'), true)
    assert.equal(isReservedFeedHandle('Groups'), true)
    assert.equal(isReservedFeedHandle('sera'), false)
    assert.equal(memberFeedHref('people'), '/feed/u/people')
    assert.equal(memberFeedHref('sera'), '/feed/sera')
  })
})
