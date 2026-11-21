import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createGroupMemory } from './groups'
import { canInteract, type CanInteractContext } from './interact'

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

function teamMemory() {
  return createGroupMemory({
    now: () => new Date('2026-11-20T12:00:00.000Z'),
    newId: (() => {
      let n = 0
      return () => `id-${++n}`
    })(),
  })
}

describe('group team tools', () => {
  it('lets the owner transfer the group (success path)', () => {
    const mem = teamMemory()
    const category = mem.createCategory({ name: 'Team', kind: 'team', slug: 'team' })
    assert.equal(category.ok, true)
    if (!category.ok) return

    const created = mem.createGroup({
      name: 'Alpha Squad',
      categoryId: category.category.id,
      ownerUserId: 'alice',
      visibility: 'open',
    })
    assert.equal(created.ok, true)
    if (!created.ok) return

    const joined = mem.join(created.group.id, 'bob')
    assert.equal(joined.ok, true)
    if (!joined.ok) return

    const transferred = mem.transfer({
      groupId: created.group.id,
      actorUserId: 'alice',
      newOwnerUserId: 'bob',
      interact: interactOk(),
    })
    assert.equal(transferred.ok, true)
    if (!transferred.ok) return
    assert.equal(transferred.group.ownerUserId, 'bob')
    assert.equal(mem.getMembership(created.group.id, 'bob')?.role, 'owner')
    assert.equal(mem.getMembership(created.group.id, 'alice')?.role, 'admin')

    const deleteAsFormerOwner = mem.deleteGroup({
      groupId: created.group.id,
      actorUserId: 'alice',
    })
    assert.deepEqual(deleteAsFormerOwner, { ok: false, reason: 'not_owner' })

    const deleted = mem.deleteGroup({
      groupId: created.group.id,
      actorUserId: 'bob',
    })
    assert.deepEqual(deleted, { ok: true, groupId: created.group.id })
    assert.equal(mem.getGroup(created.group.id), null)
  })

  it('refuses when a rank tries to remove the owner or an admin (failure path)', () => {
    const mem = teamMemory()
    const category = mem.createCategory({
      name: 'Association',
      kind: 'association',
      slug: 'association',
    })
    assert.equal(category.ok, true)
    if (!category.ok) return

    const created = mem.createGroup({
      name: 'Club House',
      categoryId: category.category.id,
      ownerUserId: 'alice',
      visibility: 'open',
    })
    assert.equal(created.ok, true)
    if (!created.ok) return

    assert.equal(mem.join(created.group.id, 'bob').ok, true)
    assert.equal(mem.join(created.group.id, 'carol').ok, true)
    assert.equal(mem.join(created.group.id, 'dave').ok, true)

    const promoted = mem.setMemberRole({
      groupId: created.group.id,
      actorUserId: 'alice',
      targetUserId: 'bob',
      role: 'admin',
    })
    assert.equal(promoted.ok, true)
    if (!promoted.ok) return
    assert.equal(promoted.membership.role, 'admin')

    const rank = mem.createRank({
      groupId: created.group.id,
      actorUserId: 'alice',
      name: 'Sergeant',
      canManageMembers: true,
    })
    assert.equal(rank.ok, true)
    if (!rank.ok) return

    const assigned = mem.assignRank({
      groupId: created.group.id,
      actorUserId: 'alice',
      targetUserId: 'carol',
      rankId: rank.rank.id,
    })
    assert.equal(assigned.ok, true)
    if (!assigned.ok) return
    assert.equal(assigned.membership.rankId, rank.rank.id)

    const againstOwner = mem.removeMember({
      groupId: created.group.id,
      actorUserId: 'carol',
      targetUserId: 'alice',
    })
    assert.deepEqual(againstOwner, { ok: false, reason: 'protected_member' })
    assert.equal(mem.getMembership(created.group.id, 'alice')?.role, 'owner')

    const againstAdmin = mem.removeMember({
      groupId: created.group.id,
      actorUserId: 'carol',
      targetUserId: 'bob',
    })
    assert.deepEqual(againstAdmin, { ok: false, reason: 'protected_member' })
    assert.equal(mem.getMembership(created.group.id, 'bob')?.role, 'admin')

    const againstMember = mem.removeMember({
      groupId: created.group.id,
      actorUserId: 'carol',
      targetUserId: 'dave',
    })
    assert.equal(againstMember.ok, true)
    assert.equal(mem.getMembership(created.group.id, 'dave'), null)
  })

  it('refuses transfer when the pair is blocked (blocked-user case)', () => {
    const mem = teamMemory()
    const category = mem.createCategory({ name: 'Team B', kind: 'team', slug: 'team-b' })
    assert.equal(category.ok, true)
    if (!category.ok) return

    const created = mem.createGroup({
      name: 'Blocked Cell',
      categoryId: category.category.id,
      ownerUserId: 'alice',
      visibility: 'open',
    })
    assert.equal(created.ok, true)
    if (!created.ok) return
    assert.equal(mem.join(created.group.id, 'bob').ok, true)

    const interact = interactOk({ isBlocked: true })
    assert.equal(canInteract('alice', 'bob', interact), false)

    const refused = mem.transfer({
      groupId: created.group.id,
      actorUserId: 'alice',
      newOwnerUserId: 'bob',
      interact,
    })
    assert.deepEqual(refused, { ok: false, reason: 'blocked' })
    assert.equal(mem.getGroup(created.group.id)?.ownerUserId, 'alice')
  })
})
