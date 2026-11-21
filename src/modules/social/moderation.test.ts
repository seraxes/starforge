import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { canInteract, isSocialBanned, type CanInteractContext } from './interact'
import { createMemberMemory } from './members'
import {
  createCommentMemory,
  canViewComment,
} from './comments'
import {
  createReportMemory,
} from './reports'
import {
  createPostMemory,
  createPostRecord,
  type CanViewPostContext,
} from './posts'
import {
  createFriendshipMemory,
  requestFriendshipWithInteract,
} from './friends'

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

describe('moderation', () => {
  it('resolves an open report and staff-hides the post (success path)', () => {
    const now = () => new Date('2026-11-20T01:00:00.000Z')
    const posts = createPostMemory({ newId: () => 'post-1', now })
    const created = posts.create({
      authorUserId: 'alice',
      body: 'spammy',
      audience: 'public',
    })
    assert.equal(created.ok, true)
    if (!created.ok) return

    const reports = createReportMemory({ newId: () => 'rpt-1', now })
    const flagged = reports.create(
      { reporterUserId: 'bob', postId: created.post.id, reason: 'spam' },
      {
        post: created.post,
        viewCtx: viewCtx({ viewerUserId: 'bob', areFriends: false }),
      },
    )
    assert.equal(flagged.ok, true)
    if (!flagged.ok) return
    assert.equal(reports.listOpen().length, 1)

    const refused = reports.resolve(
      { actorUserId: 'mod', reportId: flagged.report.id, status: 'hidden' },
      { canManageReports: false },
    )
    assert.deepEqual(refused, { ok: false, reason: 'cannot_manage' })

    const resolved = reports.resolve(
      { actorUserId: 'mod', reportId: flagged.report.id, status: 'hidden' },
      { canManageReports: true },
    )
    assert.equal(resolved.ok, true)
    if (!resolved.ok) return
    assert.equal(resolved.report.status, 'hidden')
    assert.equal(resolved.hidePost, true)
    assert.equal(resolved.hideCommentId, null)
    assert.equal(reports.listOpen().length, 0)
    assert.equal(reports.getOpen('bob', created.post.id), null)

    const hidden = posts.setStaffHidden(
      {
        actorUserId: 'mod',
        postId: created.post.id,
        staffHidden: true,
      },
      { canManagePosts: true },
    )
    assert.equal(hidden.ok, true)
    if (!hidden.ok) return
    assert.equal(hidden.post.staffHidden, true)

    // Comment hide / restore on the same queue path.
    const comments = createCommentMemory({ newId: () => 'c-1', now })
    const comment = comments.create(
      { authorUserId: 'carol', postId: created.post.id, body: 'also bad' },
      {
        post: hidden.post,
        viewCtx: viewCtx({
          viewerUserId: 'carol',
          areFriends: false,
          canManagePosts: true,
        }),
        interactCtx: interactCtx(),
      },
    )
    assert.equal(comment.ok, true)
    if (!comment.ok) return

    const hideComment = comments.setStaffHidden(
      { actorUserId: 'mod', commentId: comment.comment.id, staffHidden: true },
      { canManagePosts: true },
    )
    assert.equal(hideComment.ok, true)
    if (!hideComment.ok) return
    assert.equal(hideComment.comment.staffHidden, true)
    assert.equal(
      canViewComment(hideComment.comment, {
        viewerUserId: 'bob',
        canManagePosts: false,
      }),
      false,
    )
    assert.equal(
      canViewComment(hideComment.comment, {
        viewerUserId: 'carol',
        canManagePosts: false,
      }),
      true,
    )

    const restored = comments.setStaffHidden(
      { actorUserId: 'mod', commentId: comment.comment.id, staffHidden: false },
      { canManagePosts: true },
    )
    assert.equal(restored.ok, true)
    if (!restored.ok) return
    assert.equal(restored.comment.staffHidden, false)
  })

  it('refuses a banned member’s post (failure path)', () => {
    const bannedAt = new Date('2026-11-20T02:00:00.000Z')
    assert.equal(isSocialBanned(bannedAt), true)
    assert.equal(isSocialBanned(null), false)

    const members = createMemberMemory({
      now: () => bannedAt,
    })
    const ban = members.ban(
      { actorUserId: 'mod', userId: 'alice' },
      { canManageReports: true },
    )
    assert.equal(ban.ok, true)
    if (!ban.ok) return
    assert.equal(ban.member.bannedAt?.toISOString(), bannedAt.toISOString())

    assert.equal(
      canInteract('alice', 'alice', interactCtx({ actorBannedAt: ban.member.bannedAt })),
      false,
    )

    const refused = createPostRecord(
      { authorUserId: 'alice', body: 'hello', audience: 'public' },
      { authorBannedAt: ban.member.bannedAt },
    )
    assert.deepEqual(refused, { ok: false, reason: 'banned' })

    const posts = createPostMemory({ newId: () => 'post-banned' })
    assert.deepEqual(
      posts.create(
        { authorUserId: 'alice', body: 'hello', audience: 'public' },
        { authorBannedAt: ban.member.bannedAt },
      ),
      { ok: false, reason: 'banned' },
    )

    // Friend request also fails canInteract when banned.
    const graph = createFriendshipMemory()
    assert.deepEqual(
      requestFriendshipWithInteract(null, 'alice', 'bob', interactCtx({
        actorBannedAt: ban.member.bannedAt,
      })),
      { ok: false, reason: 'banned' },
    )
    assert.equal(graph.get('alice', 'bob'), null)

    // Unban clears the gate.
    const unban = members.unban(
      { actorUserId: 'mod', userId: 'alice' },
      { canManageReports: true },
    )
    assert.equal(unban.ok, true)
    if (!unban.ok) return
    assert.equal(unban.member.bannedAt, null)
    const allowed = createPostRecord(
      { authorUserId: 'alice', body: 'back', audience: 'public' },
      { authorBannedAt: unban.member.bannedAt },
    )
    assert.equal(allowed.ok, true)
  })

  it('refuses canInteract when the pair is blocked (blocked-user case)', () => {
    assert.equal(
      canInteract('bob', 'alice', interactCtx({ isBlocked: true })),
      false,
    )
    assert.deepEqual(
      requestFriendshipWithInteract(
        null,
        'bob',
        'alice',
        interactCtx({ isBlocked: true }),
      ),
      { ok: false, reason: 'blocked' },
    )
  })
})
