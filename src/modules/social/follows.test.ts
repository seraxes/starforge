import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { canInteract, type CanInteractContext } from './interact'
import {
  createFollowMemory,
  isFollowingFeedCandidate,
} from './follows'
import {
  createPostRecord,
  isReservedFeedHandle,
  type CanViewPostContext,
  type PostRecord,
} from './posts'

function interactOk(overrides: Partial<CanInteractContext> = {}): CanInteractContext {
  return {
    isBlocked: false,
    actorHidden: false,
    otherHidden: false,
    actorBannedAt: null,
    otherBannedAt: null,
    ...overrides,
  }
}

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

describe('follows', () => {
  it('follows a member and lists their public posts on Following (success path)', () => {
    const mem = createFollowMemory({
      now: () => new Date('2026-11-20T19:00:00.000Z'),
      newId: (() => {
        let n = 0
        return () => `id-${++n}`
      })(),
    })

    const followed = mem.follow({
      followerUserId: 'bob',
      followeeUserId: 'alice',
      interact: interactOk(),
    })
    assert.equal(followed.ok, true)
    if (!followed.ok) return
    assert.equal(followed.write, 'insert')
    assert.equal(followed.follow.followerUserId, 'bob')
    assert.equal(followed.follow.followeeUserId, 'alice')
    assert.deepEqual(mem.listFolloweeIds('bob'), ['alice'])

    // Unique pair: second follow updates the open row.
    const again = mem.follow({
      followerUserId: 'bob',
      followeeUserId: 'alice',
      interact: interactOk(),
    })
    assert.equal(again.ok, true)
    if (!again.ok) return
    assert.equal(again.write, 'update')
    assert.equal(again.follow.id, followed.follow.id)
    assert.equal(mem.listFolloweeIds('bob').length, 1)

    const publicPost = makePost('alice', 'public', 'hello world')
    const friendsOnly = makePost('alice', 'friends', 'friends only')
    const strangerPublic = makePost('carol', 'public', 'not followed')

    assert.equal(
      isFollowingFeedCandidate(publicPost, new Set(['alice'])),
      true,
    )
    assert.equal(
      isFollowingFeedCandidate(friendsOnly, new Set(['alice'])),
      false,
    )

    const feed = mem.followingFeed(
      [strangerPublic, friendsOnly, publicPost],
      'bob',
      () =>
        viewCtx({
          viewerUserId: 'bob',
          areFriends: false,
        }),
    )
    assert.equal(feed.length, 1)
    assert.equal(feed[0]!.id, publicPost.id)

    assert.equal(isReservedFeedHandle('following'), true)
  })

  it('refuses a follow after a block (failure path)', () => {
    const mem = createFollowMemory({
      now: () => new Date('2026-11-20T19:00:00.000Z'),
      newId: () => 'id-1',
    })

    const blocked = interactOk({ isBlocked: true })
    assert.equal(canInteract('bob', 'alice', blocked), false)

    const refused = mem.follow({
      followerUserId: 'bob',
      followeeUserId: 'alice',
      interact: blocked,
    })
    assert.deepEqual(refused, { ok: false, reason: 'blocked' })
    assert.equal(mem.get('bob', 'alice'), null)
    assert.deepEqual(mem.listFolloweeIds('bob'), [])
  })
})
