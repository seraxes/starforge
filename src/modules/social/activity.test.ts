import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createActivityMemory } from './activity'
import { canViewPost, type CanViewPostContext } from './posts'

function viewCtx(overrides: Partial<CanViewPostContext> = {}): CanViewPostContext {
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

describe('publishActivity', () => {
  it('writes an activity card when Social is on (success path)', async () => {
    const mem = createActivityMemory({
      now: () => new Date('2026-11-20T12:00:00.000Z'),
      newId: (() => {
        let n = 0
        return () => `id-${++n}`
      })(),
    })

    const door = await mem.publishThroughDoor(true, {
      sourceModule: 'product:events',
      sourceId: 'evt-1',
      activityKind: 'event.published',
      actorUserId: 'alice',
      snapshot: { title: 'Open day', href: '/events/evt-1' },
    })

    assert.equal(door.ok, true)
    if (!door.ok) return
    assert.equal(door.value.ok, true)
    if (!door.value.ok) return

    assert.equal(mem.count(), 1)
    assert.equal(door.value.activity.sourceModule, 'product:events')
    assert.equal(door.value.activity.sourceId, 'evt-1')
    assert.equal(door.value.activity.activityKind, 'event.published')
    assert.equal(door.value.activity.actorUserId, 'alice')
    assert.equal(door.value.post.kind, 'activity')
    assert.equal(door.value.post.audience, 'friends')
    assert.equal(door.value.post.body, 'Open day')
    assert.equal(door.value.post.authorUserId, 'alice')

    // Uniqueness: republish updates the open row (no second insert).
    const again = await mem.publishThroughDoor(true, {
      sourceModule: 'product:events',
      sourceId: 'evt-1',
      activityKind: 'event.published',
      actorUserId: 'alice',
      snapshot: { title: 'Open day (updated)', href: '/events/evt-1' },
    })
    assert.equal(again.ok, true)
    if (!again.ok) return
    assert.equal(again.value.ok, true)
    if (!again.value.ok) return
    assert.equal(mem.count(), 1)
    assert.equal(again.value.activity.id, door.value.activity.id)
    assert.equal(again.value.activity.snapshot.title, 'Open day (updated)')
    assert.equal(again.value.post.body, 'Open day (updated)')
  })

  it('returns without writing when Social is off (failure path)', async () => {
    const mem = createActivityMemory()
    let workRan = false
    const door = await mem.publishThroughDoor(false, {
      sourceModule: 'product:pages',
      sourceId: 'page-1',
      activityKind: 'page.published',
      actorUserId: 'alice',
      snapshot: { title: 'About' },
    })
    // Door short-circuits before apply — prove no side effects.
    workRan = mem.count() > 0

    assert.deepEqual(door, { ok: false, reason: 'disabled' })
    assert.equal(mem.count(), 0)
    assert.equal(workRan, false)

    const afterOn = await mem.publishThroughDoor(true, {
      sourceModule: 'product:pages',
      sourceId: 'page-1',
      activityKind: 'page.published',
      actorUserId: 'alice',
      snapshot: { title: 'About' },
    })
    assert.equal(afterOn.ok, true)
    assert.equal(mem.count(), 1)
  })

  it('refuses canViewPost on an activity card when the pair is blocked (blocked-user case)', async () => {
    const mem = createActivityMemory()
    const door = await mem.publishThroughDoor(true, {
      sourceModule: 'product:events',
      sourceId: 'evt-block',
      activityKind: 'event.published',
      actorUserId: 'alice',
      snapshot: { title: 'Match' },
    })
    assert.equal(door.ok, true)
    if (!door.ok || !door.value.ok) return

    assert.equal(
      canViewPost(door.value.post, viewCtx({ isBlocked: true })),
      false,
    )
    assert.equal(
      canViewPost(door.value.post, viewCtx({ isBlocked: false, areFriends: true })),
      true,
    )
  })
})
