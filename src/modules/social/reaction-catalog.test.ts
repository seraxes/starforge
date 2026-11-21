import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { CanInteractContext } from './interact'
import {
  createPostRecord,
  type CanViewPostContext,
  type PostRecord,
} from './posts'
import {
  DEFAULT_ENABLED_REACTION_KINDS,
  REACTION_KINDS,
  createReactionMemory,
  decidePostLike,
  isReactionKindEnabled,
  normalizeEnabledReactionKinds,
} from './reactions'

function interactCtx(
  overrides: Partial<CanInteractContext> = {},
): CanInteractContext {
  return {
    isBlocked: false,
    actorHidden: false,
    otherHidden: false,
    actorBannedAt: null,
    otherBannedAt: null,
    ...overrides,
  }
}

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

function publicPost(authorUserId = 'alice'): PostRecord {
  const created = createPostRecord({
    authorUserId,
    body: 'hello',
    audience: 'public',
  })
  assert.equal(created.ok, true)
  if (!created.ok) throw new Error('expected post')
  return created.post
}

describe('reaction catalog', () => {
  it('accepts the enabled kind like (success path)', () => {
    assert.deepEqual([...REACTION_KINDS], [
      'like',
      'love',
      'haha',
      'wow',
      'sad',
      'angry',
    ])
    assert.deepEqual([...DEFAULT_ENABLED_REACTION_KINDS], ['like'])
    assert.equal(isReactionKindEnabled('like'), true)
    assert.equal(isReactionKindEnabled('love'), false)

    const post = publicPost()
    const memory = createReactionMemory({
      newId: () => 'rxn-1',
      now: () => new Date('2026-11-20T21:00:00.000Z'),
    })
    const result = memory.likePost(
      { actorUserId: 'bob', postId: post.id, kind: 'like' },
      {
        post,
        viewCtx: viewCtx({ viewerUserId: 'bob', areFriends: false }),
        interactCtx: interactCtx(),
      },
    )
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.reaction.kind, 'like')
    assert.equal(result.reaction.id, 'rxn-1')

    // Choosing another enabled kind updates that one row (not a second insert).
    const withLove = createReactionMemory({
      newId: () => 'rxn-2',
      now: () => new Date('2026-11-20T21:05:00.000Z'),
      enabledKinds: ['like', 'love'],
    })
    const first = withLove.likePost(
      { actorUserId: 'bob', postId: post.id, kind: 'like' },
      {
        post,
        viewCtx: viewCtx({ viewerUserId: 'bob' }),
        interactCtx: interactCtx(),
      },
    )
    assert.equal(first.ok, true)
    if (!first.ok) return
    const switched = withLove.likePost(
      { actorUserId: 'bob', postId: post.id, kind: 'love' },
      {
        post,
        viewCtx: viewCtx({ viewerUserId: 'bob' }),
        interactCtx: interactCtx(),
      },
    )
    assert.equal(switched.ok, true)
    if (!switched.ok) return
    assert.equal(switched.reaction.id, first.reaction.id)
    assert.equal(switched.reaction.kind, 'love')
    assert.equal(withLove.get('bob', 'post', post.id)?.kind, 'love')
  })

  it('refuses a disabled kind (failure path)', () => {
    const post = publicPost()
    assert.deepEqual(
      decidePostLike(
        null,
        { actorUserId: 'bob', postId: post.id, kind: 'love' },
        { canView: true, canInteract: true },
      ),
      { ok: false, reason: 'disabled_kind' },
    )
    assert.deepEqual(
      decidePostLike(
        null,
        { actorUserId: 'bob', postId: post.id, kind: 'angry' },
        { canView: true, canInteract: true },
      ),
      { ok: false, reason: 'disabled_kind' },
    )
    // Unknown string is still invalid_kind (not in the catalog).
    assert.deepEqual(
      decidePostLike(
        null,
        { actorUserId: 'bob', postId: post.id, kind: 'celebrate' },
        { canView: true, canInteract: true },
      ),
      { ok: false, reason: 'invalid_kind' },
    )

    const memory = createReactionMemory()
    const result = memory.likePost(
      { actorUserId: 'bob', postId: post.id, kind: 'wow' },
      {
        post,
        viewCtx: viewCtx(),
        interactCtx: interactCtx(),
      },
    )
    assert.deepEqual(result, { ok: false, reason: 'disabled_kind' })
    assert.equal(memory.get('bob', 'post', post.id), null)

    // like cannot be stripped from the enabled set.
    assert.deepEqual(normalizeEnabledReactionKinds(['love', 'haha']), [
      'like',
      'love',
      'haha',
    ])
    assert.deepEqual(normalizeEnabledReactionKinds([]), ['like'])
  })
})
