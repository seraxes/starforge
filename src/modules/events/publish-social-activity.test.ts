import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  EVENTS_ACTIVITY_KIND,
  EVENTS_ACTIVITY_SOURCE_MODULE,
  notifyEventPublishedActivity,
  type SocialPublishActivityFn,
} from './publish-social-activity'
import type { EventRecord } from './types'

function publishedEvent(
  overrides: Partial<Pick<EventRecord, 'id' | 'title' | 'slug' | 'status' | 'coverMediaId'>> = {},
): Pick<EventRecord, 'id' | 'title' | 'slug' | 'status' | 'coverMediaId'> {
  return {
    id: 'evt-1',
    title: 'Open day',
    slug: 'open-day',
    status: 'published',
    coverMediaId: 'media-cover',
    ...overrides,
  }
}

/** In-memory door stand-in: upsert by (sourceModule, sourceId, activityKind). */
function createMemoryDoor(): {
  cards: Map<string, { title?: string; href?: string; mediaId?: string }>
  publishActivity: SocialPublishActivityFn
  count: () => number
} {
  const cards = new Map<string, { title?: string; href?: string; mediaId?: string }>()
  return {
    cards,
    count: () => cards.size,
    publishActivity: async (input) => {
      const key = `${input.sourceModule}\0${input.sourceId}\0${input.activityKind}`
      cards.set(key, {
        title: input.snapshot?.title,
        href: input.snapshot?.href,
        mediaId: input.snapshot?.mediaId,
      })
      return { ok: true }
    },
  }
}

describe('notifyEventPublishedActivity', () => {
  it('publish writes one card', async () => {
    const door = createMemoryDoor()
    let sourcePublished = false

    // Source publish already succeeded before the Social call.
    sourcePublished = true
    await notifyEventPublishedActivity(
      { event: publishedEvent(), actorUserId: 'alice' },
      { loadPublishActivity: async () => door.publishActivity },
    )

    assert.equal(sourcePublished, true)
    assert.equal(door.count(), 1)
    const card = door.cards.get(
      `${EVENTS_ACTIVITY_SOURCE_MODULE}\0evt-1\0${EVENTS_ACTIVITY_KIND}`,
    )
    assert.ok(card)
    assert.equal(card.title, 'Open day')
    assert.equal(card.href, '/events/open-day')
    assert.equal(card.mediaId, 'media-cover')
  })

  it('republish updates the same card', async () => {
    const door = createMemoryDoor()
    const load = async () => door.publishActivity

    await notifyEventPublishedActivity(
      { event: publishedEvent(), actorUserId: 'alice' },
      { loadPublishActivity: load },
    )
    await notifyEventPublishedActivity(
      {
        event: publishedEvent({ title: 'Open day (updated)', coverMediaId: '' }),
        actorUserId: 'alice',
      },
      { loadPublishActivity: load },
    )

    assert.equal(door.count(), 1)
    const card = door.cards.get(
      `${EVENTS_ACTIVITY_SOURCE_MODULE}\0evt-1\0${EVENTS_ACTIVITY_KIND}`,
    )
    assert.ok(card)
    assert.equal(card.title, 'Open day (updated)')
    assert.equal(card.mediaId, undefined)
  })

  it('Social disabled writes nothing and the source publish still succeeds', async () => {
    const door = createMemoryDoor()
    let sourcePublished = false

    sourcePublished = true
    // Social off → door missing (loadModuleDoor null).
    await notifyEventPublishedActivity(
      { event: publishedEvent(), actorUserId: 'alice' },
      { loadPublishActivity: async () => null },
    )
    assert.equal(sourcePublished, true)
    assert.equal(door.count(), 0)

    // Social off → publishActivity short-circuits to disabled (no bag write).
    await notifyEventPublishedActivity(
      { event: publishedEvent(), actorUserId: 'alice' },
      {
        loadPublishActivity: async () => async () => ({ ok: false, reason: 'disabled' }),
      },
    )
    assert.equal(sourcePublished, true)
    assert.equal(door.count(), 0)
  })

  it('switch off writes nothing', async () => {
    const door = createMemoryDoor()
    let sourcePublished = false

    sourcePublished = true
    // Pack switch off → Social publishActivity returns disabled (no write).
    await notifyEventPublishedActivity(
      { event: publishedEvent(), actorUserId: 'alice' },
      {
        loadPublishActivity: async () => async () => ({ ok: false, reason: 'disabled' }),
      },
    )

    assert.equal(sourcePublished, true)
    assert.equal(door.count(), 0)

    // Draft status never calls the door.
    let doorCalls = 0
    await notifyEventPublishedActivity(
      {
        event: publishedEvent({ status: 'draft' }),
        actorUserId: 'alice',
      },
      {
        loadPublishActivity: async () => {
          doorCalls += 1
          return door.publishActivity
        },
      },
    )
    assert.equal(doorCalls, 0)
    assert.equal(door.count(), 0)
  })
})
