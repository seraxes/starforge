import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createCommentMemory, decideCreateComment, decideDeleteComment } from './comments'
import {
  createHostConversationMemory,
  hostConversationAuthorId,
} from './host-conversation'
import { canInteract, type CanInteractContext } from './interact'
import { canViewPost, type CanViewPostContext, type PostRecord } from './posts'
import { createReportMemory, decideCreateReport } from './reports'

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
    areFriends: false,
    isBlocked: false,
    authorHidden: false,
    isGroupMember: false,
    isPageLiker: false,
    isPageAdmin: false,
    canManagePosts: false,
    hostCanView: false,
    ...overrides,
  }
}

describe('host conversation', () => {
  it('Social off writes nothing (door disabled)', async () => {
    const mem = createHostConversationMemory({
      newId: (() => {
        let n = 0
        return () => `id-${++n}`
      })(),
    })
    const result = await mem.ensureThroughDoor(false, {
      hostModule: 'product:events',
      hostId: 'evt-1',
      hostPath: '/events/open-day',
    })
    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.reason, 'disabled')
    assert.equal(mem.findByHost('product:events', 'evt-1'), null)
  })

  it('member can comment and reply when hostCanView + canInteract', () => {
    const mem = createHostConversationMemory({
      newId: (() => {
        let n = 0
        return () => `id-${++n}`
      })(),
      now: () => new Date('2026-11-28T10:00:00.000Z'),
    })
    const ensured = mem.ensure({
      hostModule: 'product:events',
      hostId: 'evt-1',
      hostPath: '/events/open-day',
    })
    assert.equal(ensured.ok, true)
    if (!ensured.ok) return
    const post = ensured.post
    assert.equal(post.kind, 'conversation')
    assert.equal(
      canViewPost(post, viewCtx({ viewerUserId: 'bob', hostCanView: true })),
      true,
    )

    const comments = createCommentMemory({
      newId: (() => {
        let n = 0
        return () => `c-${++n}`
      })(),
      now: () => new Date('2026-11-28T10:01:00.000Z'),
    })
    const top = comments.create(
      { authorUserId: 'bob', postId: post.id, body: 'looking forward' },
      {
        post,
        viewCtx: viewCtx({ viewerUserId: 'bob', hostCanView: true }),
        interactCtx: interactCtx(),
      },
    )
    assert.equal(top.ok, true)
    if (!top.ok) return

    const reply = comments.create(
      {
        authorUserId: 'carol',
        postId: post.id,
        body: 'same',
        parentCommentId: top.comment.id,
      },
      {
        post,
        viewCtx: viewCtx({ viewerUserId: 'carol', hostCanView: true }),
        interactCtx: interactCtx(),
      },
    )
    assert.equal(reply.ok, true)
    if (!reply.ok) return
    assert.equal(reply.comment.parentCommentId, top.comment.id)
  })

  it('stranger who cannot view the event cannot comment', () => {
    const mem = createHostConversationMemory({
      newId: () => 'post-host-1',
      now: () => new Date('2026-11-28T10:00:00.000Z'),
    })
    const ensured = mem.ensure({
      hostModule: 'product:events',
      hostId: 'private-evt',
    })
    assert.equal(ensured.ok, true)
    if (!ensured.ok) return
    const post = ensured.post

    assert.equal(
      canViewPost(post, viewCtx({ viewerUserId: 'stranger', hostCanView: false })),
      false,
    )

    const decision = decideCreateComment(
      { authorUserId: 'stranger', postId: post.id, body: 'sneak' },
      {
        canView: false,
        canInteract: canInteract('stranger', post.authorUserId, interactCtx()),
        parent: null,
      },
    )
    assert.equal(decision.ok, false)
    if (decision.ok) return
    assert.equal(decision.reason, 'cannot_view')
  })

  it('comment author can delete; host moderator and Social staff can delete', () => {
    const post: PostRecord = {
      id: 'conv-post',
      authorUserId: hostConversationAuthorId('product:events', 'evt-1'),
      body: '',
      kind: 'conversation',
      audience: 'public',
      groupId: null,
      pageId: null,
      staffHidden: false,
      pendingReview: false,
      isAnnouncement: false,
      editedAt: null,
      extensions: {},
      media: [],
      sharedPostId: null,
      linkUrl: null,
      linkTitle: null,
      linkDescription: null,
      linkImageUrl: null,
      pollOptions: [],
      pollClosedAt: null,
      placeLabel: null,
      mapsPinId: null,
      placeLat: null,
      placeLng: null,
      createdAt: new Date('2026-11-28T10:00:00.000Z'),
      updatedAt: new Date('2026-11-28T10:00:00.000Z'),
    }
    const comments = createCommentMemory({
      newId: (() => {
        let n = 0
        return () => `c-${++n}`
      })(),
    })
    const created = comments.create(
      { authorUserId: 'bob', postId: post.id, body: 'hi' },
      {
        post,
        viewCtx: viewCtx({ viewerUserId: 'bob', hostCanView: true }),
        interactCtx: interactCtx(),
      },
    )
    assert.equal(created.ok, true)
    if (!created.ok) return

    const authorDelete = decideDeleteComment(
      created.comment,
      { actorUserId: 'bob', commentId: created.comment.id },
      [],
    )
    assert.equal(authorDelete.ok, true)

    const hostModDelete = decideDeleteComment(
      created.comment,
      { actorUserId: 'manager', commentId: created.comment.id },
      [],
      { canManagePosts: true },
    )
    assert.equal(hostModDelete.ok, true)

    const staffDelete = decideDeleteComment(
      created.comment,
      { actorUserId: 'admin', commentId: created.comment.id },
      [],
      { canManagePosts: true },
    )
    assert.equal(staffDelete.ok, true)

    const strangerDelete = decideDeleteComment(
      created.comment,
      { actorUserId: 'stranger', commentId: created.comment.id },
      [],
      { canManagePosts: false },
    )
    assert.equal(strangerDelete.ok, false)
  })

  it('report still requires existing report rules (canView + postId)', () => {
    const mem = createHostConversationMemory({ newId: () => 'post-r1' })
    const ensured = mem.ensure({
      hostModule: 'product:pages',
      hostId: 'page-1',
    })
    assert.equal(ensured.ok, true)
    if (!ensured.ok) return

    const noPost = decideCreateReport(
      null,
      { reporterUserId: 'bob', reason: 'spam' },
      { canView: true, comment: null },
    )
    assert.equal(noPost.ok, false)
    if (noPost.ok) return
    assert.equal(noPost.reason, 'no_post')

    const cannotView = decideCreateReport(
      null,
      { reporterUserId: 'bob', postId: ensured.post.id, reason: 'spam' },
      { canView: false, comment: null },
    )
    assert.equal(cannotView.ok, false)
    if (cannotView.ok) return
    assert.equal(cannotView.reason, 'cannot_view')

    const reports = createReportMemory({ newId: () => 'rpt-1' })
    const ok = reports.create(
      { reporterUserId: 'bob', postId: ensured.post.id, reason: 'spam' },
      {
        post: ensured.post,
        viewCtx: viewCtx({ viewerUserId: 'bob', hostCanView: true, canManagePosts: false }),
      },
    )
    assert.equal(ok.ok, true)
  })

  it('staff private-read sees conversation without hostCanView', () => {
    const mem = createHostConversationMemory({ newId: () => 'post-staff' })
    const ensured = mem.ensure({
      hostModule: 'product:events',
      hostId: 'secret',
    })
    assert.equal(ensured.ok, true)
    if (!ensured.ok) return
    assert.equal(
      canViewPost(
        ensured.post,
        viewCtx({ viewerUserId: 'admin', hostCanView: false, canManagePosts: true }),
      ),
      true,
    )
  })
})
