import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { canInteract, type CanInteractContext } from './interact'
import {
  createMentionsTagsSavesMemory,
  extractHashtags,
  extractMentionHandles,
  normalizeTag,
} from './mentions-tags-saves'
import {
  createPostRecord,
  isReservedFeedHandle,
  type CanViewPostContext,
  type PostRecord,
} from './posts'

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

function makePost(
  authorUserId: string,
  audience: 'public' | 'friends' | 'only_me',
  body: string,
): PostRecord {
  const created = createPostRecord({
    authorUserId,
    body,
    audience,
  })
  assert.equal(created.ok, true)
  if (!created.ok) throw new Error('expected post')
  return created.post
}

describe('mentions-tags-saves', () => {
  it('saves a visible post, lists it on Saved, tags a feed, and notifies a mention (success path)', () => {
    const mem = createMentionsTagsSavesMemory({
      now: () => new Date('2026-11-20T20:00:00.000Z'),
      newId: (() => {
        let n = 0
        return () => `id-${++n}`
      })(),
    })

    const publicPost = makePost('alice', 'public', 'Hello @carol #starforge')
    assert.deepEqual(extractHashtags(publicPost.body), ['starforge'])
    assert.deepEqual(extractMentionHandles(publicPost.body), ['carol'])
    assert.equal(normalizeTag('#StarForge'), 'starforge')

    const saved = mem.save(
      { userId: 'bob', postId: publicPost.id },
      { canView: true },
    )
    assert.equal(saved.ok, true)
    if (!saved.ok) return
    assert.equal(saved.write, 'insert')
    assert.equal(saved.save.userId, 'bob')
    assert.equal(saved.save.postId, publicPost.id)

    // Unique (userId, postId): second save updates the open row.
    const again = mem.save(
      { userId: 'bob', postId: publicPost.id },
      { canView: true },
    )
    assert.equal(again.ok, true)
    if (!again.ok) return
    assert.equal(again.write, 'update')
    assert.equal(again.save.id, saved.save.id)

    const onlyMe = makePost('alice', 'only_me', 'secret #starforge')
    mem.setTags(publicPost.id, extractHashtags(publicPost.body))
    mem.setTags(onlyMe.id, extractHashtags(onlyMe.body))

    const tagFeed = mem.tagFeed(
      [onlyMe, publicPost],
      'starforge',
      (post) =>
        viewCtx({
          viewerUserId: 'bob',
          // only_me from alice is invisible to bob
          ...(post.id === onlyMe.id ? {} : {}),
        }),
    )
    assert.equal(tagFeed.length, 1)
    assert.equal(tagFeed[0]!.id, publicPost.id)

    const savedFeed = mem.savedFeed(
      [onlyMe, publicPost],
      'bob',
      () => viewCtx({ viewerUserId: 'bob' }),
    )
    assert.equal(savedFeed.length, 1)
    assert.equal(savedFeed[0]!.id, publicPost.id)

    const notified: string[] = []
    const mention = mem.notifyMentions(
      'alice',
      [{ userId: 'carol', handle: 'carol' }],
      () => interactOk(),
      (userId) => {
        notified.push(userId)
      },
    )
    assert.deepEqual(mention.notifyUserIds, ['carol'])
    assert.deepEqual(notified, ['carol'])
    assert.equal(mention.skipped.length, 0)

    assert.equal(isReservedFeedHandle('saved'), true)
    assert.equal(isReservedFeedHandle('tag'), true)
  })

  it('refuses saving a post the viewer cannot see, and does not notify a blocked mention (failure path)', () => {
    const mem = createMentionsTagsSavesMemory({
      now: () => new Date('2026-11-20T20:00:00.000Z'),
      newId: () => 'id-1',
    })

    const hidden = makePost('alice', 'only_me', 'private')
    const refused = mem.save(
      { userId: 'bob', postId: hidden.id },
      { canView: false },
    )
    assert.deepEqual(refused, { ok: false, reason: 'cannot_view' })
    assert.equal(mem.getSave('bob', hidden.id), null)

    const blocked = interactOk({ isBlocked: true })
    assert.equal(canInteract('alice', 'dave', blocked), false)

    const notified: string[] = []
    const decision = mem.notifyMentions(
      'alice',
      [{ userId: 'dave', handle: 'dave' }],
      () => blocked,
      (userId) => {
        notified.push(userId)
      },
    )
    assert.deepEqual(decision.notifyUserIds, [])
    assert.deepEqual(notified, [])
    assert.equal(decision.skipped.length, 1)
    assert.equal(decision.skipped[0]!.userId, 'dave')
    assert.equal(decision.skipped[0]!.reason, 'blocked')
  })
})
