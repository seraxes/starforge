import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { canInteract, type CanInteractContext } from './interact'
import {
  STORY_TTL_MS,
  computeStoryExpiresAt,
  createStoryMemory,
  isStoryExpired,
  listStoryViewerIds,
  selectActiveStories,
} from './stories'

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

describe('stories visibility + viewers', () => {
  it('keeps an active story visible (success path)', () => {
    const createdAt = new Date('2026-11-20T12:00:00.000Z')
    const mem = createStoryMemory({
      now: () => createdAt,
      newId: (() => {
        let n = 0
        return () => `id-${++n}`
      })(),
    })

    const created = mem.create({
      authorUserId: 'alice',
      mediaId: 'media-story-1',
    })
    assert.equal(created.ok, true)
    if (!created.ok) return

    assert.deepEqual(created.story.expiresAt, computeStoryExpiresAt(createdAt))
    assert.equal(created.story.expiresAt.getTime() - createdAt.getTime(), STORY_TTL_MS)
    assert.equal(created.story.expiredAt, null)
    assert.equal(isStoryExpired(created.story, createdAt), false)

    const beforeExpiry = new Date(created.story.expiresAt.getTime() - 1)
    assert.equal(
      mem.canView('bob', created.story.id, interactOk(), beforeExpiry),
      true,
    )
    assert.equal(selectActiveStories([created.story], beforeExpiry).length, 1)
    assert.equal(mem.listActive(beforeExpiry).length, 1)
  })

  it('hides an expired story (failure path)', () => {
    const createdAt = new Date('2026-11-20T12:00:00.000Z')
    const mem = createStoryMemory({
      now: () => createdAt,
      newId: (() => {
        let n = 0
        return () => `id-${++n}`
      })(),
    })

    const created = mem.create({
      authorUserId: 'alice',
      mediaId: 'media-story-2',
    })
    assert.equal(created.ok, true)
    if (!created.ok) return

    const afterExpiry = new Date(created.story.expiresAt.getTime())
    assert.equal(isStoryExpired(created.story, afterExpiry), true)
    assert.equal(
      mem.canView('bob', created.story.id, interactOk(), afterExpiry),
      false,
    )
    assert.equal(
      mem.canView('alice', created.story.id, interactOk(), afterExpiry),
      false,
    )
    assert.deepEqual(selectActiveStories([created.story], afterExpiry), [])
    assert.deepEqual(mem.listActive(afterExpiry), [])

    const sweep = mem.sweep(afterExpiry)
    assert.deepEqual(sweep.expireIds, [created.story.id])
    const swept = mem.getStory(created.story.id)
    assert.ok(swept)
    assert.deepEqual(swept!.expiredAt, afterExpiry)
    // Media id is unchanged — file stays in product:media.
    assert.equal(swept!.mediaId, 'media-story-2')
  })

  it('omits a blocked viewer from the author viewer list (blocked-user case)', () => {
    const createdAt = new Date('2026-11-20T12:00:00.000Z')
    const mem = createStoryMemory({
      now: () => createdAt,
      newId: (() => {
        let n = 0
        return () => `id-${++n}`
      })(),
    })

    const created = mem.create({
      authorUserId: 'alice',
      mediaId: 'media-story-3',
    })
    assert.equal(created.ok, true)
    if (!created.ok) return

    const okView = mem.recordView({
      storyId: created.story.id,
      userId: 'bob',
      interact: interactOk(),
    })
    assert.equal(okView.ok, true)

    const blocked = interactOk({ isBlocked: true })
    assert.equal(canInteract('carol', 'alice', blocked), false)
    // View row may exist from before the block; list still omits via canInteract.
    mem.bag.views.set(`${created.story.id}\0carol`, {
      id: 'view-carol',
      storyId: created.story.id,
      userId: 'carol',
      createdAt,
      updatedAt: createdAt,
    })

    const viewers = listStoryViewerIds(created.story, [...mem.bag.views.values()], (viewer) => {
      if (viewer === 'carol') return blocked
      return interactOk()
    })
    assert.deepEqual(viewers, ['bob'])
    assert.equal(viewers.includes('carol'), false)

    const refused = mem.recordView({
      storyId: created.story.id,
      userId: 'dave',
      interact: blocked,
    })
    assert.equal(refused.ok, false)
    if (!refused.ok) assert.equal(refused.reason, 'blocked')
  })
})
