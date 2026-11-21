import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  createGroupMemory,
  inviteToGroupWithMail,
  isGroupMemberForPost,
  type InviteToGroupInput,
} from './groups'
import { canInteract, type CanInteractContext } from './interact'
import { canViewPost, type CanViewPostContext } from './posts'

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

describe('groups membership + canViewPost', () => {
  it('lets an active member see a group wall post (success path)', () => {
    const mem = createGroupMemory({
      now: () => new Date('2026-11-20T12:00:00.000Z'),
      newId: (() => {
        let n = 0
        return () => `id-${++n}`
      })(),
    })

    const category = mem.createCategory({ name: 'General', kind: 'general' })
    assert.equal(category.ok, true)
    if (!category.ok) return

    const created = mem.createGroup({
      name: 'Night Ops',
      categoryId: category.category.id,
      ownerUserId: 'alice',
      visibility: 'open',
    })
    assert.equal(created.ok, true)
    if (!created.ok) return

    const joined = mem.join(created.group.id, 'bob')
    assert.equal(joined.ok, true)
    if (!joined.ok) return
    assert.equal(joined.membership.status, 'active')

    const wall = mem.wallPost({
      authorUserId: 'alice',
      groupId: created.group.id,
      body: 'Briefing at 20:00',
    })
    assert.equal(wall.ok, true)
    if (!wall.ok) return
    assert.equal(wall.post.audience, 'group')
    assert.equal(wall.post.groupId, created.group.id)

    const membership = mem.getMembership(created.group.id, 'bob')
    assert.equal(isGroupMemberForPost(wall.post.groupId, membership), true)
    assert.equal(
      canViewPost(
        wall.post,
        viewCtx({
          viewerUserId: 'bob',
          isGroupMember: isGroupMemberForPost(wall.post.groupId, membership),
        }),
      ),
      true,
    )
  })

  it('refuses canViewPost for a non-member (failure path)', () => {
    const mem = createGroupMemory({
      now: () => new Date('2026-11-20T12:00:00.000Z'),
      newId: (() => {
        let n = 0
        return () => `id-${++n}`
      })(),
    })

    const category = mem.createCategory({ name: 'Team', kind: 'team', slug: 'team' })
    assert.equal(category.ok, true)
    if (!category.ok) return

    const created = mem.createGroup({
      name: 'Closed Cell',
      categoryId: category.category.id,
      ownerUserId: 'alice',
      visibility: 'closed',
    })
    assert.equal(created.ok, true)
    if (!created.ok) return

    const wall = mem.wallPost({
      authorUserId: 'alice',
      groupId: created.group.id,
      body: 'Members only',
    })
    assert.equal(wall.ok, true)
    if (!wall.ok) return

    const strangerMembership = mem.getMembership(created.group.id, 'carol')
    assert.equal(strangerMembership, null)
    assert.equal(isGroupMemberForPost(wall.post.groupId, strangerMembership), false)
    assert.equal(
      canViewPost(
        wall.post,
        viewCtx({
          viewerUserId: 'carol',
          isGroupMember: isGroupMemberForPost(wall.post.groupId, strangerMembership),
        }),
      ),
      false,
    )
  })

  it('refuses a group invite when the pair is blocked (blocked-user case)', async () => {
    const mem = createGroupMemory({
      now: () => new Date('2026-11-20T12:00:00.000Z'),
      newId: (() => {
        let n = 0
        return () => `id-${++n}`
      })(),
    })

    const category = mem.createCategory({
      name: 'Association',
      kind: 'association',
      slug: 'association',
    })
    assert.equal(category.ok, true)
    if (!category.ok) return

    const created = mem.createGroup({
      name: 'Airsoft Club',
      categoryId: category.category.id,
      ownerUserId: 'alice',
      visibility: 'open',
    })
    assert.equal(created.ok, true)
    if (!created.ok) return

    const interact = interactOk({ isBlocked: true })
    assert.equal(canInteract('alice', 'bob', interact), false)

    const inviteInput: InviteToGroupInput = {
      groupId: created.group.id,
      actorUserId: 'alice',
      inviteeUserId: 'bob',
      interact,
    }
    const refused = mem.invite(inviteInput)
    assert.deepEqual(refused, { ok: false, reason: 'blocked' })
    assert.equal(mem.getMembership(created.group.id, 'bob'), null)

    let emitCalls = 0
    const withMail = await inviteToGroupWithMail(
      () => mem.invite(inviteInput),
      async () => {
        emitCalls += 1
      },
    )
    assert.deepEqual(withMail, { ok: false, reason: 'blocked' })
    assert.equal(emitCalls, 0)
  })
})
