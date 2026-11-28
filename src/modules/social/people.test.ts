import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { canInteract } from './interact'
import {
  createFriendshipMemory,
  isBlockedBetween,
  requestFriendshipWithMail,
} from './friends'
import {
  countMutualFriends,
  formatMutualFriendCount,
  isPeopleDirectoryCandidate,
  isPeopleSuggestionCandidate,
  selectPeopleDirectory,
  selectPeopleSuggestions,
  type PeopleSuggestionCandidate,
} from './people'
import { canViewPost, createPostRecord } from './posts'

describe('people — dual blockers', () => {
  it('records a mutual block without erasing either side (success path)', () => {
    const graph = createFriendshipMemory()
    assert.equal(graph.block('alice', 'bob').ok, true)
    const first = graph.get('alice', 'bob')
    assert.equal(first?.status, 'blocked')
    assert.equal(first?.blockedBy, 'alice')
    assert.equal(first?.blockedByOther, null)
    assert.equal(isBlockedBetween(first), true)

    assert.equal(graph.block('bob', 'alice').ok, true)
    const mutual = graph.get('alice', 'bob')
    assert.equal(mutual?.status, 'blocked')
    assert.equal(mutual?.blockedBy, 'alice')
    assert.equal(mutual?.blockedByOther, 'bob')
    assert.equal(isBlockedBetween(mutual), true)

    assert.equal(
      canInteract('alice', 'bob', {
        isBlocked: isBlockedBetween(mutual),
        actorHidden: false,
        otherHidden: false,
        actorBannedAt: null,
        otherBannedAt: null,
      }),
      false,
    )

    const post = createPostRecord({
      authorUserId: 'alice',
      body: 'hi',
      audience: 'public',
    })
    assert.equal(post.ok, true)
    if (!post.ok) return
    assert.equal(
      canViewPost(post.post, {
        viewerUserId: 'bob',
        areFriends: false,
        isBlocked: isBlockedBetween(mutual),
        authorHidden: false,
        isGroupMember: false,
        isPageLiker: false,
        isPageAdmin: false,
        canManagePosts: false,
      }),
      false,
    )
  })

  it('lets each side clear only its own block (success path)', () => {
    const graph = createFriendshipMemory()
    assert.equal(graph.block('alice', 'bob').ok, true)
    assert.equal(graph.block('bob', 'alice').ok, true)

    const clearedOther = graph.unblock('alice', 'bob')
    assert.equal(clearedOther.ok, true)
    if (!clearedOther.ok) return
    assert.equal(clearedOther.friendship?.blockedBy, null)
    assert.equal(clearedOther.friendship?.blockedByOther, 'bob')
    assert.equal(isBlockedBetween(clearedOther.friendship), true)

    // Alice is no longer a recorded blocker — cannot clear Bob’s side.
    const steal = graph.unblock('alice', 'bob')
    assert.deepEqual(steal, { ok: false, reason: 'not_blocker' })
    assert.equal(graph.get('alice', 'bob')?.blockedByOther, 'bob')

    const clearedOwn = graph.unblock('bob', 'alice')
    assert.deepEqual(clearedOwn, { ok: true, friendship: null })
    assert.equal(graph.get('alice', 'bob'), null)
  })

  it('refuses a request after a block (failure path)', () => {
    const graph = createFriendshipMemory()
    assert.equal(graph.block('alice', 'bob').ok, true)
    assert.equal(graph.block('bob', 'alice').ok, true)

    const blockedRequest = graph.request('bob', 'alice')
    assert.deepEqual(blockedRequest, { ok: false, reason: 'blocked' })
    assert.equal(graph.get('alice', 'bob')?.status, 'blocked')
    assert.equal(graph.get('alice', 'bob')?.blockedBy, 'alice')
    assert.equal(graph.get('alice', 'bob')?.blockedByOther, 'bob')
  })

  it('keeps the request when mail emit fails (success path)', async () => {
    const graph = createFriendshipMemory()
    let emitCalls = 0
    const result = await requestFriendshipWithMail(
      () => graph.request('alice', 'bob'),
      async () => {
        emitCalls += 1
        throw new Error('smtp down')
      },
    )
    assert.equal(result.ok, true)
    assert.equal(emitCalls, 1)
    assert.equal(graph.get('alice', 'bob')?.status, 'pending')
    assert.equal(graph.get('alice', 'bob')?.requesterId, 'alice')
  })
})

describe('people directory', () => {
  it('omits hidden and blocked people', () => {
    const selected = selectPeopleDirectory(
      [
        { userId: 'alice', isHidden: false, isBlocked: false },
        { userId: 'hidden-user', isHidden: true, isBlocked: false },
        { userId: 'blocked-user', isHidden: false, isBlocked: true },
        { userId: 'viewer', isHidden: false, isBlocked: false },
      ],
      'viewer',
    )
    assert.deepEqual(
      selected.map((p) => p.userId),
      ['alice'],
    )
    assert.equal(
      isPeopleDirectoryCandidate('blocked-user', 'viewer', {
        isHidden: false,
        isBlocked: true,
      }),
      false,
    )
  })
})

describe('people suggestions / mutual friends', () => {
  function candidate(
    partial: Partial<PeopleSuggestionCandidate> & Pick<PeopleSuggestionCandidate, 'userId'>,
  ): PeopleSuggestionCandidate {
    return {
      isHidden: false,
      isBlocked: false,
      isFriend: false,
      isBanned: false,
      mutualFriendCount: 0,
      ...partial,
    }
  }

  it('counts shared accepted friends correctly (success path)', () => {
    assert.equal(
      countMutualFriends(new Set(['carol', 'dave', 'erin']), new Set(['dave', 'frank', 'carol'])),
      2,
    )
    assert.equal(countMutualFriends(new Set(['carol']), new Set(['dave'])), 0)
    assert.equal(formatMutualFriendCount(2), '2 mutual friends')
    assert.equal(formatMutualFriendCount(1), '1 mutual friend')
    assert.equal(formatMutualFriendCount(0), null)
  })

  it('omits a blocked person from suggestions (failure path)', () => {
    const selected = selectPeopleSuggestions(
      [
        candidate({ userId: 'blocked-user', isBlocked: true, mutualFriendCount: 3 }),
        candidate({ userId: 'carol', mutualFriendCount: 2 }),
      ],
      'viewer',
    )
    assert.deepEqual(
      selected.map((p) => p.userId),
      ['carol'],
    )
    assert.equal(
      isPeopleSuggestionCandidate('blocked-user', 'viewer', {
        isHidden: false,
        isBlocked: true,
        isFriend: false,
        isBanned: false,
        mutualFriendCount: 3,
      }),
      false,
    )
  })

  it('omits an existing friend from suggestions (failure path)', () => {
    const selected = selectPeopleSuggestions(
      [
        candidate({ userId: 'bob', isFriend: true, mutualFriendCount: 5 }),
        candidate({ userId: 'carol', mutualFriendCount: 1 }),
      ],
      'viewer',
    )
    assert.deepEqual(
      selected.map((p) => p.userId),
      ['carol'],
    )
  })

  it('omits self from suggestions (failure path)', () => {
    const selected = selectPeopleSuggestions(
      [
        candidate({ userId: 'viewer', mutualFriendCount: 4 }),
        candidate({ userId: 'carol', mutualFriendCount: 1 }),
      ],
      'viewer',
    )
    assert.deepEqual(
      selected.map((p) => p.userId),
      ['carol'],
    )
  })

  it('yields an empty suggestion list when every candidate has zero mutuals (failure path)', () => {
    const selected = selectPeopleSuggestions(
      [
        candidate({ userId: 'alice', mutualFriendCount: 0 }),
        candidate({ userId: 'bob', mutualFriendCount: 0 }),
        candidate({ userId: 'carol', mutualFriendCount: 0 }),
      ],
      'viewer',
    )
    assert.deepEqual(selected, [])
  })
})
