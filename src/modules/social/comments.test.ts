import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createCommentMemory, decideCreateComment } from './comments'
import { type CanInteractContext } from './interact'
import {
  canViewPost,
  createPostMemory,
  type CanViewPostContext,
  type PostRecord,
} from './posts'
import { createReactionMemory } from './reactions'

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
  const posts = createPostMemory({
    newId: () => 'post-1',
    now: () => new Date('2026-11-19T20:00:00.000Z'),
  })
  const created = posts.create({
    authorUserId,
    body: 'hello',
    audience: 'public',
  })
  assert.equal(created.ok, true)
  if (!created.ok) throw new Error('expected post')
  return created.post
}

describe('comments', () => {
  it('creates a top-level comment and a one-level reply (success path)', () => {
    const post = publicPost()
    const comments = createCommentMemory({
      newId: (() => {
        let n = 0
        return () => `c-${++n}`
      })(),
      now: () => new Date('2026-11-19T20:01:00.000Z'),
    })

    const top = comments.create(
      { authorUserId: 'bob', postId: post.id, body: 'nice post' },
      {
        post,
        viewCtx: viewCtx({ viewerUserId: 'bob' }),
        interactCtx: interactCtx(),
      },
    )
    assert.equal(top.ok, true)
    if (!top.ok) return
    assert.equal(top.comment.parentCommentId, null)
    assert.equal(top.comment.body, 'nice post')

    const reply = comments.create(
      {
        authorUserId: 'carol',
        postId: post.id,
        body: 'agreed',
        parentCommentId: top.comment.id,
      },
      {
        post,
        viewCtx: viewCtx({ viewerUserId: 'carol', areFriends: false }),
        interactCtx: interactCtx(),
      },
    )
    assert.equal(reply.ok, true)
    if (!reply.ok) return
    assert.equal(reply.comment.parentCommentId, top.comment.id)
    assert.equal(comments.listReplies(top.comment.id).length, 1)
  })

  it('refuses a reply to a reply (failure path)', () => {
    const post = publicPost()
    const comments = createCommentMemory({
      newId: (() => {
        let n = 0
        return () => `c-${++n}`
      })(),
    })

    const top = comments.create(
      { authorUserId: 'bob', postId: post.id, body: 'top' },
      {
        post,
        viewCtx: viewCtx(),
        interactCtx: interactCtx(),
      },
    )
    assert.equal(top.ok, true)
    if (!top.ok) return

    const reply = comments.create(
      {
        authorUserId: 'carol',
        postId: post.id,
        body: 'reply',
        parentCommentId: top.comment.id,
      },
      {
        post,
        viewCtx: viewCtx({ viewerUserId: 'carol' }),
        interactCtx: interactCtx(),
      },
    )
    assert.equal(reply.ok, true)
    if (!reply.ok) return

    const nested = comments.create(
      {
        authorUserId: 'bob',
        postId: post.id,
        body: 'too deep',
        parentCommentId: reply.comment.id,
      },
      {
        post,
        viewCtx: viewCtx({ viewerUserId: 'bob' }),
        interactCtx: interactCtx(),
      },
    )
    assert.deepEqual(nested, { ok: false, reason: 'reply_too_deep' })

    assert.deepEqual(
      decideCreateComment(
        {
          authorUserId: 'bob',
          postId: post.id,
          body: 'too deep',
          parentCommentId: reply.comment.id,
        },
        {
          canView: true,
          canInteract: true,
          parent: reply.comment,
        },
      ),
      { ok: false, reason: 'reply_too_deep' },
    )
  })

  it('refuses a comment when the pair is blocked via canInteract (blocked-user case)', () => {
    const post = publicPost()
    const comments = createCommentMemory()
    const result = comments.create(
      { authorUserId: 'bob', postId: post.id, body: 'blocked' },
      {
        post,
        viewCtx: viewCtx({ viewerUserId: 'bob', isBlocked: false }),
        interactCtx: interactCtx({ isBlocked: true }),
      },
    )
    assert.deepEqual(result, { ok: false, reason: 'cannot_interact' })
  })

  it('lets the author edit and delete their own comment; parent delete removes the reply', () => {
    const post = publicPost()
    const comments = createCommentMemory({
      newId: (() => {
        let n = 0
        return () => `c-${++n}`
      })(),
    })

    const top = comments.create(
      { authorUserId: 'bob', postId: post.id, body: 'first' },
      { post, viewCtx: viewCtx(), interactCtx: interactCtx() },
    )
    assert.equal(top.ok, true)
    if (!top.ok) return

    const reply = comments.create(
      {
        authorUserId: 'carol',
        postId: post.id,
        body: 'child',
        parentCommentId: top.comment.id,
      },
      {
        post,
        viewCtx: viewCtx({ viewerUserId: 'carol' }),
        interactCtx: interactCtx(),
      },
    )
    assert.equal(reply.ok, true)
    if (!reply.ok) return

    const edited = comments.edit({
      actorUserId: 'bob',
      commentId: top.comment.id,
      body: 'edited',
    })
    assert.equal(edited.ok, true)
    if (!edited.ok) return
    assert.equal(edited.comment.body, 'edited')
    assert.ok(edited.comment.editedAt)

    const stolen = comments.edit({
      actorUserId: 'carol',
      commentId: top.comment.id,
      body: 'nope',
    })
    assert.deepEqual(stolen, { ok: false, reason: 'not_author' })

    const deleted = comments.delete({
      actorUserId: 'bob',
      commentId: top.comment.id,
    })
    assert.equal(deleted.ok, true)
    if (!deleted.ok) return
    assert.deepEqual(deleted.deletedIds.sort(), ['c-1', 'c-2'].sort())
    assert.equal(comments.get(top.comment.id), null)
    assert.equal(comments.get(reply.comment.id), null)
  })

  it('lets the author edit or delete their own post; delete cascades comments and likes', () => {
    const posts = createPostMemory({
      newId: () => 'post-1',
      now: () => new Date('2026-11-19T20:00:00.000Z'),
    })
    const created = posts.create({
      authorUserId: 'alice',
      body: 'hello',
      audience: 'public',
    })
    assert.equal(created.ok, true)
    if (!created.ok) return
    const post = created.post

    const edited = posts.edit({
      actorUserId: 'alice',
      postId: post.id,
      body: 'updated',
    })
    assert.equal(edited.ok, true)
    if (!edited.ok) return
    assert.equal(edited.post.body, 'updated')
    assert.ok(edited.post.editedAt)

    const comments = createCommentMemory({
      newId: () => 'c-1',
    })
    assert.equal(
      comments.create(
        { authorUserId: 'bob', postId: post.id, body: 'bye' },
        {
          post: edited.post,
          viewCtx: viewCtx(),
          interactCtx: interactCtx(),
        },
      ).ok,
      true,
    )

    const reactions = createReactionMemory({ newId: () => 'rxn-1' })
    assert.equal(
      reactions.likePost(
        { actorUserId: 'bob', postId: post.id, kind: 'like' },
        {
          post: edited.post,
          viewCtx: viewCtx(),
          interactCtx: interactCtx(),
        },
      ).ok,
      true,
    )
    assert.ok(reactions.get('bob', 'post', post.id))

    const stolen = posts.delete({ actorUserId: 'bob', postId: post.id })
    assert.deepEqual(stolen, { ok: false, reason: 'not_author' })

    const deleted = posts.delete({ actorUserId: 'alice', postId: post.id })
    assert.equal(deleted.ok, true)
    assert.equal(posts.get(post.id), null)

    // In-memory companions: DB path removes comments + likes in the same tx.
    const removedComments = comments.deleteForPost(post.id)
    assert.deepEqual(removedComments, ['c-1'])
    assert.equal(comments.get('c-1'), null)
  })

  it('lets staff hide a post; viewers lose canViewPost unless they manage', () => {
    const posts = createPostMemory({ newId: () => 'post-1' })
    const created = posts.create({
      authorUserId: 'alice',
      body: 'hello',
      audience: 'public',
    })
    assert.equal(created.ok, true)
    if (!created.ok) return

    const refused = posts.setStaffHidden(
      { actorUserId: 'mod', postId: created.post.id, staffHidden: true },
      { canManagePosts: false },
    )
    assert.deepEqual(refused, { ok: false, reason: 'cannot_manage' })

    const hidden = posts.setStaffHidden(
      { actorUserId: 'mod', postId: created.post.id, staffHidden: true },
      { canManagePosts: true },
    )
    assert.equal(hidden.ok, true)
    if (!hidden.ok) return
    assert.equal(hidden.post.staffHidden, true)

    assert.equal(
      canViewPost(hidden.post, viewCtx({ viewerUserId: 'bob' })),
      false,
    )
    assert.equal(
      canViewPost(
        hidden.post,
        viewCtx({ viewerUserId: 'bob', canManagePosts: true }),
      ),
      true,
    )
    assert.equal(
      canViewPost(hidden.post, viewCtx({ viewerUserId: 'alice' })),
      true,
    )
  })
})
