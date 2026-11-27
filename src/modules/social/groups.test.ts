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

describe('closed-group join approval', () => {
  function closedMemory() {
    return createGroupMemory({
      now: () => new Date('2026-11-20T12:00:00.000Z'),
      newId: (() => {
        let n = 0
        return () => `id-${++n}`
      })(),
    })
  }

  function seedClosedGroup() {
    const mem = closedMemory()
    const category = mem.createCategory({ name: 'General', kind: 'general' })
    assert.equal(category.ok, true)
    if (!category.ok) throw new Error('category')
    const created = mem.createGroup({
      name: 'Closed Cell',
      categoryId: category.category.id,
      ownerUserId: 'alice',
      visibility: 'closed',
    })
    assert.equal(created.ok, true)
    if (!created.ok) throw new Error('group')
    return { mem, groupId: created.group.id }
  }

  it('approves a requested member to active (success path)', () => {
    const { mem, groupId } = seedClosedGroup()
    const requested = mem.join(groupId, 'bob')
    assert.equal(requested.ok, true)
    if (!requested.ok) return
    assert.equal(requested.membership.status, 'requested')

    const approved = mem.approveJoin({
      groupId,
      actorUserId: 'alice',
      targetUserId: 'bob',
    })
    assert.equal(approved.ok, true)
    if (!approved.ok) return
    assert.equal(approved.membership.status, 'active')
    assert.equal(mem.getMembership(groupId, 'bob')?.status, 'active')
  })

  it('refuses stranger, ordinary member, banned, already active, and over cap (failure path)', () => {
    const { mem, groupId } = seedClosedGroup()
    assert.equal(mem.join(groupId, 'bob').ok, true)

    assert.deepEqual(
      mem.approveJoin({
        groupId,
        actorUserId: 'carol',
        targetUserId: 'bob',
      }),
      { ok: false, reason: 'not_allowed' },
    )

    assert.equal(mem.join(groupId, 'dave').ok, true)
    // Open join is not used here; promote dave via approve first then treat as member.
    // dave is still requested — approve him, then he cannot approve bob.
    assert.equal(
      mem.approveJoin({
        groupId,
        actorUserId: 'alice',
        targetUserId: 'dave',
      }).ok,
      true,
    )
    assert.deepEqual(
      mem.approveJoin({
        groupId,
        actorUserId: 'dave',
        targetUserId: 'bob',
      }),
      { ok: false, reason: 'not_allowed' },
    )

    assert.deepEqual(
      mem.approveJoin(
        {
          groupId,
          actorUserId: 'alice',
          targetUserId: 'bob',
        },
        { actorBannedAt: new Date('2026-11-01T00:00:00.000Z') },
      ),
      { ok: false, reason: 'banned' },
    )

    assert.equal(
      mem.approveJoin({
        groupId,
        actorUserId: 'alice',
        targetUserId: 'bob',
      }).ok,
      true,
    )
    assert.deepEqual(
      mem.approveJoin({
        groupId,
        actorUserId: 'alice',
        targetUserId: 'bob',
      }),
      { ok: false, reason: 'already_member' },
    )

    assert.equal(mem.join(groupId, 'erin').ok, true)
    assert.deepEqual(
      mem.approveJoin(
        {
          groupId,
          actorUserId: 'alice',
          targetUserId: 'erin',
        },
        { activeMemberCount: 2, maxGroupMembers: 2 },
      ),
      { ok: false, reason: 'member_cap' },
    )
  })

  it('declines a request so the person can ask again (failure / clear path)', () => {
    const { mem, groupId } = seedClosedGroup()
    assert.equal(mem.join(groupId, 'bob').ok, true)

    const declined = mem.declineJoin({
      groupId,
      actorUserId: 'alice',
      targetUserId: 'bob',
    })
    assert.equal(declined.ok, true)
    if (!declined.ok) return
    assert.equal(mem.getMembership(groupId, 'bob'), null)

    const again = mem.join(groupId, 'bob')
    assert.equal(again.ok, true)
    if (!again.ok) return
    assert.equal(again.membership.status, 'requested')
  })
})
