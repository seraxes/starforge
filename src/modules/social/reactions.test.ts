import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { canInteract, type CanInteractContext } from './interact'
import {
  createPostRecord,
  type CanViewPostContext,
  type PostRecord,
} from './posts'
import {
  createReactionMemory,
  decideClearReaction,
  decideCommentLike,
  decidePostLike,
  type ReactionRecord,
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

describe('canInteract truth table', () => {
  it('allows when block, hidden, and banned are all clear (success path)', () => {
    assert.equal(canInteract('bob', 'alice', interactCtx()), true)
    assert.equal(canInteract('alice', 'alice', interactCtx()), true)
  })

  it('refuses when either side has blocked (failure path)', () => {
    assert.equal(
      canInteract('bob', 'alice', interactCtx({ isBlocked: true })),
      false,
    )
  })

  it('refuses when either account is hidden (failure path)', () => {
    assert.equal(
      canInteract('bob', 'alice', interactCtx({ actorHidden: true })),
      false,
    )
    assert.equal(
      canInteract('bob', 'alice', interactCtx({ otherHidden: true })),
      false,
    )
  })

  it('refuses when either member has a Social bannedAt (failure path)', () => {
    const bannedAt = new Date('2026-11-20T00:00:00.000Z')
    assert.equal(
      canInteract('bob', 'alice', interactCtx({ actorBannedAt: bannedAt })),
      false,
    )
    assert.equal(
      canInteract('bob', 'alice', interactCtx({ otherBannedAt: bannedAt })),
      false,
    )
  })
})

describe('post likes', () => {
  it('likes a visible post when canInteract allows (success path)', () => {
    const post = publicPost()
    const memory = createReactionMemory({
      newId: () => 'rxn-1',
      now: () => new Date('2026-11-19T19:00:00.000Z'),
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
    assert.equal(result.reaction.targetType, 'post')
    assert.equal(result.reaction.targetId, post.id)
    assert.equal(result.reaction.actorUserId, 'bob')
    assert.equal(memory.get('bob', 'post', post.id)?.id, 'rxn-1')

    // Second like on the same target keeps one unique row.
    const again = memory.likePost(
      { actorUserId: 'bob', postId: post.id, kind: 'like' },
      {
        post,
        viewCtx: viewCtx({ viewerUserId: 'bob' }),
        interactCtx: interactCtx(),
      },
    )
    assert.equal(again.ok, true)
    if (!again.ok) return
    assert.equal(again.reaction.id, 'rxn-1')
  })

  it('refuses a second kind when it is disabled or unknown (failure path)', () => {
    const post = publicPost()
    // Catalog kind that is off → disabled_kind (slice 22).
    assert.deepEqual(
      decidePostLike(
        null,
        { actorUserId: 'bob', postId: post.id, kind: 'love' },
        { canView: true, canInteract: true },
      ),
      { ok: false, reason: 'disabled_kind' },
    )
    // Not in the catalog → invalid_kind.
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
  })

  it('refuses a like on a post canViewPost denies (failure path)', () => {
    const onlyMe = createPostRecord({
      authorUserId: 'alice',
      body: 'secret',
      audience: 'only_me',
    })
    assert.equal(onlyMe.ok, true)
    if (!onlyMe.ok) return

    const memory = createReactionMemory()
    const result = memory.likePost(
      { actorUserId: 'bob', postId: onlyMe.post.id, kind: 'like' },
      {
        post: onlyMe.post,
        viewCtx: viewCtx({
          viewerUserId: 'bob',
          areFriends: true,
        }),
        interactCtx: interactCtx(),
      },
    )
    assert.deepEqual(result, { ok: false, reason: 'cannot_view' })
    assert.equal(memory.get('bob', 'post', onlyMe.post.id), null)
  })

  it('refuses a like when the pair is blocked via canInteract (failure path)', () => {
    const post = publicPost()
    const memory = createReactionMemory()
    const result = memory.likePost(
      { actorUserId: 'bob', postId: post.id, kind: 'like' },
      {
        post,
        viewCtx: viewCtx({ viewerUserId: 'bob', isBlocked: false }),
        interactCtx: interactCtx({ isBlocked: true }),
      },
    )
    assert.deepEqual(result, { ok: false, reason: 'cannot_interact' })
    assert.equal(memory.get('bob', 'post', post.id), null)
  })

  it('likes a comment when reactions on comments are on (success path)', () => {
    const result = decideCommentLike(
      null,
      { actorUserId: 'bob', commentId: 'c-1', kind: 'love' },
      { canView: true, canInteract: true, reactionsOnComments: true },
      { enabledKinds: ['like', 'love'], newId: () => 'r-1', now: new Date('2026-01-01T00:00:00Z') },
    )
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.write, 'insert')
    assert.equal(result.reaction.targetType, 'comment')
    assert.equal(result.reaction.kind, 'love')
  })

  it('refuses a comment reaction when the pack switch is off (failure path)', () => {
    const result = decideCommentLike(
      null,
      { actorUserId: 'bob', commentId: 'c-1', kind: 'like' },
      { canView: true, canInteract: true, reactionsOnComments: false },
    )
    assert.deepEqual(result, { ok: false, reason: 'disabled_kind' })
  })

  it('clears the active reaction (success path)', () => {
    const current: ReactionRecord = {
      id: 'rxn-1',
      actorUserId: 'bob',
      targetType: 'post',
      targetId: 'post-1',
      kind: 'like',
      createdAt: new Date('2026-11-19T19:00:00.000Z'),
      updatedAt: new Date('2026-11-19T19:00:00.000Z'),
    }
    const cleared = decideClearReaction(
      current,
      { actorUserId: 'bob', targetType: 'post', targetId: 'post-1' },
      { canView: true, canInteract: true },
    )
    assert.deepEqual(cleared, { ok: true, write: 'delete', reaction: current })

    const missing = decideClearReaction(
      null,
      { actorUserId: 'bob', targetType: 'post', targetId: 'post-1' },
      { canView: true, canInteract: true },
    )
    assert.deepEqual(missing, { ok: true, write: 'noop' })
  })

  it('refuses to clear a reaction when the pair is blocked (failure path)', () => {
    const current: ReactionRecord = {
      id: 'rxn-1',
      actorUserId: 'bob',
      targetType: 'comment',
      targetId: 'c-1',
      kind: 'love',
      createdAt: new Date('2026-11-19T19:00:00.000Z'),
      updatedAt: new Date('2026-11-19T19:00:00.000Z'),
    }
    assert.deepEqual(
      decideClearReaction(
        current,
        { actorUserId: 'bob', targetType: 'comment', targetId: 'c-1' },
        { canView: true, canInteract: false },
      ),
      { ok: false, reason: 'cannot_interact' },
    )
  })
})
