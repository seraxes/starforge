import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { canInteract, type CanInteractContext } from './interact'
import {
  canViewPost,
  createPostRecord,
  type CanViewPostContext,
  type PostRecord,
} from './posts'
import {
  classifyLinkUrl,
  createShareLinkMemory,
  decideCreateLinkPost,
  decideCreateSharePost,
  resolveShareCard,
} from './share-links'

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
  const created = createPostRecord({
    authorUserId,
    body: 'original',
    audience: 'public',
  })
  assert.equal(created.ok, true)
  if (!created.ok) throw new Error('expected post')
  return created.post
}

describe('share and links', () => {
  it('creates a public link and a share of a visible post (success path)', () => {
    const mem = createShareLinkMemory({
      now: () => new Date('2026-11-20T18:00:00.000Z'),
      newId: (() => {
        let n = 0
        return () => `id-${++n}`
      })(),
    })

    const link = mem.createLink({
      authorUserId: 'alice',
      url: 'https://example.com/article',
      body: 'worth a read',
      preview: {
        title: 'Example article',
        description: 'A public page',
        imageUrl: 'https://example.com/og.png',
      },
    })
    assert.equal(link.ok, true)
    if (!link.ok) return
    assert.equal(link.post.kind, 'link')
    assert.equal(link.post.linkUrl, 'https://example.com/article')
    assert.equal(link.post.linkTitle, 'Example article')

    const target = publicPost('alice')
    mem.seed(target)
    const share = mem.createShare({
      authorUserId: 'bob',
      sharedPostId: target.id,
      body: 'passing this along',
      interact: interactOk(),
      canViewTarget: canViewPost(target, viewCtx({ viewerUserId: 'bob' })),
    })
    assert.equal(share.ok, true)
    if (!share.ok) return
    assert.equal(share.post.kind, 'share')
    assert.equal(share.post.sharedPostId, target.id)
    assert.equal(share.post.body, 'passing this along')

    const card = mem.resolveShare(share.post.id, viewCtx({ viewerUserId: 'carol' }))
    assert.ok(card)
    assert.equal(card!.targetOmitted, false)
    assert.equal(card!.target?.id, target.id)
  })

  it('refuses a private address (failure path)', () => {
    assert.deepEqual(classifyLinkUrl('http://127.0.0.1/admin'), {
      ok: false,
      reason: 'private_address',
    })
    assert.deepEqual(classifyLinkUrl('http://10.0.0.5/secret'), {
      ok: false,
      reason: 'private_address',
    })
    assert.deepEqual(classifyLinkUrl('http://192.168.1.1/'), {
      ok: false,
      reason: 'private_address',
    })
    assert.deepEqual(classifyLinkUrl('http://localhost/internal'), {
      ok: false,
      reason: 'private_address',
    })
    assert.deepEqual(classifyLinkUrl('http://[::1]/'), {
      ok: false,
      reason: 'private_address',
    })

    const refused = decideCreateLinkPost({
      authorUserId: 'alice',
      url: 'http://169.254.169.254/latest/meta-data/',
    })
    assert.deepEqual(refused, { ok: false, reason: 'private_address' })
  })

  it('refuses sharing a challenge post', () => {
    const challenge: PostRecord = {
      ...publicPost('alice'),
      id: 'challenge-post',
      kind: 'challenge',
      body: 'contest',
    }
    const refused = decideCreateSharePost(challenge, {
      authorUserId: 'bob',
      sharedPostId: challenge.id,
      interact: interactOk(),
      canViewTarget: true,
    })
    assert.deepEqual(refused, { ok: false, reason: 'share_forbidden' })
  })

  it('omits a target canViewPost denies', () => {
    const target = publicPost('alice')
    const onlyMe: PostRecord = { ...target, id: 'only-me', audience: 'only_me' }
    const share: PostRecord = {
      ...publicPost('bob'),
      id: 'share-1',
      kind: 'share',
      body: 'look',
      sharedPostId: onlyMe.id,
      linkUrl: null,
      linkTitle: null,
      linkDescription: null,
      linkImageUrl: null,
    }

    const denied = viewCtx({
      viewerUserId: 'carol',
      areFriends: false,
    })
    assert.equal(canViewPost(onlyMe, denied), false)
    const card = resolveShareCard(share, onlyMe, denied)
    assert.equal(card.targetOmitted, true)
    assert.equal(card.target, null)
    assert.equal(card.share.body, 'look')
  })

  it('refuses a share when canInteract is false (blocked-user case)', () => {
    const target = publicPost('alice')
    const blocked = interactOk({ isBlocked: true })
    assert.equal(canInteract('bob', 'alice', blocked), false)

    const refused = decideCreateSharePost(target, {
      authorUserId: 'bob',
      sharedPostId: target.id,
      interact: blocked,
      canViewTarget: true,
    })
    assert.deepEqual(refused, { ok: false, reason: 'blocked' })

    const hidden = interactOk({ otherHidden: true })
    assert.equal(canInteract('bob', 'alice', hidden), false)
    const refusedHidden = decideCreateSharePost(target, {
      authorUserId: 'bob',
      sharedPostId: target.id,
      interact: hidden,
      canViewTarget: true,
    })
    assert.deepEqual(refusedHidden, { ok: false, reason: 'cannot_interact' })
  })
})
