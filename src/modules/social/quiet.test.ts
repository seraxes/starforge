import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  createQuietMemory,
  matchesFeedQuietExclusion,
} from './quiet'
import {
  createPostRecord,
  type PostRecord,
} from './posts'
import {
  selectHomeFeedPageByPredicate,
  type HomeFeedVisibilityFacts,
} from './feed'
import { friendshipPairKey } from './friends'

function makePost(
  authorUserId: string,
  audience: 'public' | 'friends' | 'only_me',
  body: string,
  overrides: Partial<PostRecord> = {},
): PostRecord {
  const created = createPostRecord({
    authorUserId,
    body,
    audience,
  })
  assert.equal(created.ok, true)
  if (!created.ok) throw new Error('expected post')
  return { ...created.post, ...overrides }
}

describe('quiet hide + mute', () => {
  it('hides a visible post from the viewer’s feed only; second hide is not a duplicate (success path)', () => {
    const mem = createQuietMemory({
      now: () => new Date('2026-11-28T10:00:00.000Z'),
      newId: (() => {
        let n = 0
        return () => `id-${++n}`
      })(),
    })
    const bobPost = makePost('bob', 'friends', 'hello alice')
    const carolPost = makePost('carol', 'friends', 'also friends')

    const hidden = mem.hidePost(
      { userId: 'alice', postId: bobPost.id },
      { canView: true },
    )
    assert.equal(hidden.ok, true)
    if (!hidden.ok) return
    assert.equal(hidden.write, 'insert')
    assert.equal(hidden.hide.userId, 'alice')
    assert.equal(hidden.hide.postId, bobPost.id)

    const again = mem.hidePost(
      { userId: 'alice', postId: bobPost.id },
      { canView: true },
    )
    assert.equal(again.ok, true)
    if (!again.ok) return
    assert.equal(again.write, 'update')
    assert.equal(again.hide.id, hidden.hide.id)
    assert.equal(mem.listHiddenPostIds('alice').size, 1)

    const facts: HomeFeedVisibilityFacts = {
      friendIds: new Set(['bob', 'carol']),
      blockedPeerIds: new Set(),
      hiddenAuthorIds: new Set(),
      hiddenPostIds: mem.listHiddenPostIds('alice'),
      mutedAuthorIds: new Set(),
    }
    const page = selectHomeFeedPageByPredicate(
      [bobPost, carolPost],
      'alice',
      facts,
      10,
    )
    assert.equal(page.length, 1)
    assert.equal(page[0]!.id, carolPost.id)

    // Other viewers still see bob’s post.
    const otherPage = selectHomeFeedPageByPredicate(
      [bobPost, carolPost],
      'dave',
      {
        friendIds: new Set(['bob', 'carol']),
        blockedPeerIds: new Set(),
        hiddenAuthorIds: new Set(),
        hiddenPostIds: new Set(),
        mutedAuthorIds: new Set(),
      },
      10,
    )
    assert.equal(otherPage.length, 2)
  })

  it('mutes an author out of feeds without touching friendship; unmute restores (success path)', () => {
    const mem = createQuietMemory({
      now: () => new Date('2026-11-28T10:00:00.000Z'),
      newId: (() => {
        let n = 0
        return () => `id-${++n}`
      })(),
    })
    const pair = friendshipPairKey('alice', 'bob')
    assert.ok(pair)
    // Friendship row stays — mute must not require or clear it.
    const friendship = {
      id: 'f-1',
      requesterId: 'alice',
      addresseeId: 'bob',
      pairLow: pair!.pairLow,
      pairHigh: pair!.pairHigh,
      status: 'accepted' as const,
      blockedBy: null,
      blockedByOther: null,
      createdAt: new Date('2026-11-20T00:00:00.000Z'),
      updatedAt: new Date('2026-11-20T00:00:00.000Z'),
    }

    const muted = mem.mute({ muterUserId: 'alice', mutedUserId: 'bob' })
    assert.equal(muted.ok, true)
    if (!muted.ok) return
    assert.equal(muted.write, 'insert')
    assert.equal(muted.mute.muterUserId, 'alice')
    assert.equal(muted.mute.mutedUserId, 'bob')
    // Friendship snapshot unchanged.
    assert.equal(friendship.status, 'accepted')
    assert.equal(friendship.blockedBy, null)

    const bobPost = makePost('bob', 'friends', 'muted out')
    const carolPost = makePost('carol', 'friends', 'still visible')
    const factsMuted: HomeFeedVisibilityFacts = {
      friendIds: new Set(['bob', 'carol']),
      blockedPeerIds: new Set(),
      hiddenAuthorIds: new Set(),
      hiddenPostIds: new Set(),
      mutedAuthorIds: mem.listMutedAuthorIds('alice'),
    }
    const mutedPage = selectHomeFeedPageByPredicate(
      [bobPost, carolPost],
      'alice',
      factsMuted,
      10,
    )
    assert.equal(mutedPage.length, 1)
    assert.equal(mutedPage[0]!.id, carolPost.id)

    // Permalink / canViewPost quiet cut: mute alone does not exclude.
    assert.equal(
      matchesFeedQuietExclusion(bobPost, 'alice', {
        mutedAuthorIds: mem.listMutedAuthorIds('alice'),
      }),
      true,
    )

    const unmuted = mem.unmute('alice', 'bob')
    assert.equal(unmuted.ok, true)
    assert.equal(mem.listMutedAuthorIds('alice').size, 0)
    assert.equal(friendship.status, 'accepted')

    const restored = selectHomeFeedPageByPredicate(
      [bobPost, carolPost],
      'alice',
      {
        friendIds: new Set(['bob', 'carol']),
        blockedPeerIds: new Set(),
        hiddenAuthorIds: new Set(),
        hiddenPostIds: new Set(),
        mutedAuthorIds: mem.listMutedAuthorIds('alice'),
      },
      10,
    )
    assert.equal(restored.length, 2)
  })

  it('refuses hide when the viewer cannot see the post (failure path)', () => {
    const mem = createQuietMemory()
    const result = mem.hidePost(
      { userId: 'alice', postId: 'secret-post' },
      { canView: false },
    )
    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.reason, 'cannot_view')
    assert.equal(mem.listHiddenPostIds('alice').size, 0)
  })
})
