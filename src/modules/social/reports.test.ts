import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createCommentMemory } from './comments'
import {
  createReportMemory,
  decideCreateReport,
} from './reports'
import {
  createPostMemory,
  type CanViewPostContext,
  type PostRecord,
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

function publicPost(authorUserId = 'alice'): PostRecord {
  const posts = createPostMemory({
    newId: () => 'post-1',
    now: () => new Date('2026-11-19T21:00:00.000Z'),
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

describe('reports', () => {
  it('creates an open report on a visible post (success path)', () => {
    const post = publicPost()
    const reports = createReportMemory({
      newId: () => 'rpt-1',
      now: () => new Date('2026-11-19T21:01:00.000Z'),
    })

    const result = reports.create(
      {
        reporterUserId: 'bob',
        postId: post.id,
        reason: 'spam',
        note: 'looks fake',
      },
      {
        post,
        viewCtx: viewCtx({ viewerUserId: 'bob', areFriends: false }),
      },
    )
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.report.id, 'rpt-1')
    assert.equal(result.report.postId, post.id)
    assert.equal(result.report.commentId, null)
    assert.equal(result.report.reporterUserId, 'bob')
    assert.equal(result.report.reason, 'spam')
    assert.equal(result.report.note, 'looks fake')
    assert.equal(result.report.status, 'open')
    assert.equal(reports.getOpen('bob', post.id)?.id, 'rpt-1')

    // Optional commentId under the same post.
    const comments = createCommentMemory({
      newId: () => 'c-1',
      now: () => new Date('2026-11-19T21:02:00.000Z'),
    })
    const comment = comments.create(
      { authorUserId: 'carol', postId: post.id, body: 'bad comment' },
      {
        post,
        viewCtx: viewCtx({ viewerUserId: 'carol', areFriends: false }),
        interactCtx: {
          isBlocked: false,
          actorHidden: false,
          otherHidden: false,
          actorBannedAt: null,
          otherBannedAt: null,
        },
      },
    )
    assert.equal(comment.ok, true)
    if (!comment.ok) return

    const withComment = reports.create(
      {
        reporterUserId: 'bob',
        postId: post.id,
        commentId: comment.comment.id,
        reason: 'harassment',
      },
      {
        post,
        comment: comment.comment,
        viewCtx: viewCtx({ viewerUserId: 'bob' }),
      },
    )
    assert.equal(withComment.ok, true)
    if (!withComment.ok) return
    // Second flag updates the one open row (uniqueness).
    assert.equal(withComment.report.id, 'rpt-1')
    assert.equal(withComment.report.commentId, comment.comment.id)
    assert.equal(withComment.report.reason, 'harassment')
    assert.equal(reports.getOpen('bob', post.id)?.id, 'rpt-1')
  })

  it('refuses a report with no post (failure path)', () => {
    assert.deepEqual(
      decideCreateReport(
        null,
        { reporterUserId: 'bob', postId: '', reason: 'spam' },
        { canView: true, comment: null },
      ),
      { ok: false, reason: 'no_post' },
    )
    assert.deepEqual(
      decideCreateReport(
        null,
        { reporterUserId: 'bob', postId: null, reason: 'spam' },
        { canView: true, comment: null },
      ),
      { ok: false, reason: 'no_post' },
    )

    const reports = createReportMemory()
    const missingId = reports.create(
      { reporterUserId: 'bob', reason: 'spam' },
      {
        post: null,
        viewCtx: viewCtx(),
      },
    )
    assert.deepEqual(missingId, { ok: false, reason: 'no_post' })

    const unknownPost = reports.create(
      { reporterUserId: 'bob', postId: 'missing-post', reason: 'spam' },
      {
        post: null,
        viewCtx: viewCtx(),
      },
    )
    assert.deepEqual(unknownPost, { ok: false, reason: 'no_post' })
    assert.equal(reports.getOpen('bob', 'missing-post'), null)
  })

  it('refuses a report when the pair is blocked via canViewPost (blocked-user case)', () => {
    const post = publicPost()
    const reports = createReportMemory()
    const result = reports.create(
      { reporterUserId: 'bob', postId: post.id, reason: 'other' },
      {
        post,
        viewCtx: viewCtx({
          viewerUserId: 'bob',
          isBlocked: true,
        }),
      },
    )
    assert.deepEqual(result, { ok: false, reason: 'cannot_view' })
    assert.equal(reports.getOpen('bob', post.id), null)
  })
})
