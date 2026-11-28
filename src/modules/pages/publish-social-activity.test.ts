import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  PAGES_ACTIVITY_KIND,
  PAGES_ACTIVITY_SOURCE_MODULE,
  notifyPagePublishedActivity,
  type SocialPublishActivityFn,
} from './publish-social-activity'
import type { PageRecord } from './types'

function publishedPage(
  overrides: Partial<Pick<PageRecord, 'id' | 'title' | 'slug' | 'status' | 'metaMediaId'>> = {},
): Pick<PageRecord, 'id' | 'title' | 'slug' | 'status' | 'metaMediaId'> {
  return {
    id: 'page-1',
    title: 'About',
    slug: 'about',
    status: 'published',
    metaMediaId: 'meta-1',
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

describe('notifyPagePublishedActivity', () => {
  it('publish writes one card', async () => {
    const door = createMemoryDoor()
    let sourcePublished = false

    sourcePublished = true
    await notifyPagePublishedActivity(
      { page: publishedPage(), actorUserId: 'alice' },
      { loadPublishActivity: async () => door.publishActivity },
    )

    assert.equal(sourcePublished, true)
    assert.equal(door.count(), 1)
    const card = door.cards.get(
      `${PAGES_ACTIVITY_SOURCE_MODULE}\0page-1\0${PAGES_ACTIVITY_KIND}`,
    )
    assert.ok(card)
    assert.equal(card.title, 'About')
    assert.equal(card.href, '/about')
    assert.equal(card.mediaId, 'meta-1')
  })

  it('republish updates the same card', async () => {
    const door = createMemoryDoor()
    const load = async () => door.publishActivity

    await notifyPagePublishedActivity(
      { page: publishedPage(), actorUserId: 'alice' },
      { loadPublishActivity: load },
    )
    await notifyPagePublishedActivity(
      {
        page: publishedPage({ title: 'About us', metaMediaId: '' }),
        actorUserId: 'alice',
      },
      { loadPublishActivity: load },
    )

    assert.equal(door.count(), 1)
    const card = door.cards.get(
      `${PAGES_ACTIVITY_SOURCE_MODULE}\0page-1\0${PAGES_ACTIVITY_KIND}`,
    )
    assert.ok(card)
    assert.equal(card.title, 'About us')
    assert.equal(card.mediaId, undefined)
  })

  it('Social disabled writes nothing and the source publish still succeeds', async () => {
    const door = createMemoryDoor()
    let sourcePublished = false

    sourcePublished = true
    await notifyPagePublishedActivity(
      { page: publishedPage(), actorUserId: 'alice' },
      { loadPublishActivity: async () => null },
    )
    assert.equal(sourcePublished, true)
    assert.equal(door.count(), 0)

    await notifyPagePublishedActivity(
      { page: publishedPage(), actorUserId: 'alice' },
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
    await notifyPagePublishedActivity(
      { page: publishedPage(), actorUserId: 'alice' },
      {
        loadPublishActivity: async () => async () => ({ ok: false, reason: 'disabled' }),
      },
    )

    assert.equal(sourcePublished, true)
    assert.equal(door.count(), 0)

    let doorCalls = 0
    await notifyPagePublishedActivity(
      {
        page: publishedPage({ status: 'draft' }),
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
