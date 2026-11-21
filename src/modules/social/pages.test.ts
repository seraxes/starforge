import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { canInteract, type CanInteractContext } from './interact'
import {
  createPageMemory,
  isPageAdminForPost,
  isPageLikerForPost,
  type AddPageAdminInput,
} from './pages'
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

describe('pages likes + canViewPost', () => {
  it('lets a liker see a page wall post (success path)', () => {
    const mem = createPageMemory({
      now: () => new Date('2026-11-20T12:00:00.000Z'),
      newId: (() => {
        let n = 0
        return () => `id-${++n}`
      })(),
    })

    const created = mem.createPage({
      name: 'Night Ops Brand',
      ownerUserId: 'alice',
    })
    assert.equal(created.ok, true)
    if (!created.ok) return

    const liked = mem.like({
      pageId: created.page.id,
      userId: 'bob',
      interact: interactOk(),
      ownerUserId: 'alice',
    })
    assert.equal(liked.ok, true)
    if (!liked.ok) return

    const wall = mem.wallPost({
      authorUserId: 'alice',
      pageId: created.page.id,
      body: 'Season opener',
    })
    assert.equal(wall.ok, true)
    if (!wall.ok) return
    assert.equal(wall.post.pageId, created.page.id)

    const like = mem.getLike(created.page.id, 'bob')
    assert.equal(isPageLikerForPost(wall.post.pageId, like), true)
    assert.equal(
      canViewPost(
        wall.post,
        viewCtx({
          viewerUserId: 'bob',
          isPageLiker: isPageLikerForPost(wall.post.pageId, like),
        }),
      ),
      true,
    )
  })

  it('refuses canViewPost for a non-liker (failure path)', () => {
    const mem = createPageMemory({
      now: () => new Date('2026-11-20T12:00:00.000Z'),
      newId: (() => {
        let n = 0
        return () => `id-${++n}`
      })(),
    })

    const created = mem.createPage({
      name: 'Members Club',
      ownerUserId: 'alice',
      slug: 'members-club',
    })
    assert.equal(created.ok, true)
    if (!created.ok) return

    const wall = mem.wallPost({
      authorUserId: 'alice',
      pageId: created.page.id,
      body: 'Likers only',
    })
    assert.equal(wall.ok, true)
    if (!wall.ok) return

    const strangerLike = mem.getLike(created.page.id, 'carol')
    const strangerAdmin = mem.getAdmin(created.page.id, 'carol')
    assert.equal(strangerLike, null)
    assert.equal(strangerAdmin, null)
    assert.equal(isPageLikerForPost(wall.post.pageId, strangerLike), false)
    assert.equal(isPageAdminForPost(wall.post.pageId, strangerAdmin), false)
    assert.equal(
      canViewPost(
        wall.post,
        viewCtx({
          viewerUserId: 'carol',
          isPageLiker: isPageLikerForPost(wall.post.pageId, strangerLike),
          isPageAdmin: isPageAdminForPost(wall.post.pageId, strangerAdmin),
        }),
      ),
      false,
    )
  })

  it('refuses adding a page admin when the pair is blocked (blocked-user case)', () => {
    const mem = createPageMemory({
      now: () => new Date('2026-11-20T12:00:00.000Z'),
      newId: (() => {
        let n = 0
        return () => `id-${++n}`
      })(),
    })

    const created = mem.createPage({
      name: 'Airsoft Brand',
      ownerUserId: 'alice',
    })
    assert.equal(created.ok, true)
    if (!created.ok) return

    const interact = interactOk({ isBlocked: true })
    assert.equal(canInteract('alice', 'bob', interact), false)

    const input: AddPageAdminInput = {
      pageId: created.page.id,
      actorUserId: 'alice',
      targetUserId: 'bob',
      interact,
    }
    const refused = mem.addAdmin(input)
    assert.deepEqual(refused, { ok: false, reason: 'blocked' })
    assert.equal(mem.getAdmin(created.page.id, 'bob'), null)
  })
})
