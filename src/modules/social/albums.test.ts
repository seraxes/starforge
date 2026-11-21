import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  canViewAlbum,
  createAlbumMemory,
  type AlbumOwnerType,
} from './albums'
import { canInteract, type CanInteractContext } from './interact'
import type { MediaResolveResult } from './posts'

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

const library = new Map<string, MediaResolveResult>([
  ['img-1', { mediaId: 'img-1', mimeType: 'image/jpeg' }],
  ['img-2', { mediaId: 'img-2', mimeType: 'image/png' }],
])

function resolveKnown(mediaId: string): MediaResolveResult | null {
  return library.get(mediaId.trim()) ?? null
}

function mem() {
  return createAlbumMemory({
    now: () => new Date('2026-11-20T12:00:00.000Z'),
    newId: (() => {
      let n = 0
      return () => `id-${++n}`
    })(),
    resolveMedia: resolveKnown,
  })
}

describe('albums member / group / page', () => {
  it('adds a known mediaId to member, group, and page albums (success path)', () => {
    const albums = mem()

    const member = albums.create({
      title: 'Trip photos',
      ownerType: 'user',
      ownerId: 'alice',
      createdByUserId: 'alice',
    })
    assert.equal(member.ok, true)
    if (!member.ok) return

    const memberItem = albums.addItem({
      albumId: member.album.id,
      mediaId: 'img-1',
      actorUserId: 'alice',
    })
    assert.equal(memberItem.ok, true)
    if (!memberItem.ok) return
    assert.equal(memberItem.write, 'insert')
    assert.equal(memberItem.item.mediaId, 'img-1')
    assert.equal(albums.listItems(member.album.id).length, 1)

    const group = albums.create({
      title: 'Squad gallery',
      ownerType: 'group',
      ownerId: 'group-1',
      createdByUserId: 'bob',
      isGroupMember: true,
    })
    assert.equal(group.ok, true)
    if (!group.ok) return
    const groupItem = albums.addItem({
      albumId: group.album.id,
      mediaId: 'img-2',
      actorUserId: 'bob',
      isGroupMember: true,
    })
    assert.equal(groupItem.ok, true)
    if (!groupItem.ok) return
    assert.equal(groupItem.item.mediaId, 'img-2')

    const page = albums.create({
      title: 'Brand shots',
      ownerType: 'page' satisfies AlbumOwnerType,
      ownerId: 'page-1',
      createdByUserId: 'carol',
      isPageAdmin: true,
    })
    assert.equal(page.ok, true)
    if (!page.ok) return
    const pageItem = albums.addItem({
      albumId: page.album.id,
      mediaId: 'img-1',
      actorUserId: 'carol',
      isPageAdmin: true,
    })
    assert.equal(pageItem.ok, true)
    if (!pageItem.ok) return
    assert.equal(pageItem.item.mediaId, 'img-1')

    // Owner can view their member album.
    assert.equal(
      canViewAlbum(member.album, {
        viewerUserId: 'alice',
        interact: interactOk(),
      }),
      true,
    )
  })

  it('refuses an unknown mediaId (failure path)', () => {
    const albums = mem()
    const created = albums.create({
      title: 'Empty start',
      ownerType: 'user',
      ownerId: 'alice',
      createdByUserId: 'alice',
    })
    assert.equal(created.ok, true)
    if (!created.ok) return

    const refused = albums.addItem({
      albumId: created.album.id,
      mediaId: 'does-not-exist',
      actorUserId: 'alice',
    })
    assert.deepEqual(refused, { ok: false, reason: 'unknown_media' })
    assert.equal(albums.listItems(created.album.id).length, 0)

    const coverRefused = albums.create({
      title: 'Bad cover',
      ownerType: 'user',
      ownerId: 'alice',
      createdByUserId: 'alice',
      coverMediaId: 'missing-cover',
    })
    assert.deepEqual(coverRefused, { ok: false, reason: 'unknown_media' })
  })

  it('hides a member album from a blocked viewer (blocked-user case)', () => {
    const albums = mem()
    const created = albums.create({
      title: 'Private gallery',
      ownerType: 'user',
      ownerId: 'alice',
      createdByUserId: 'alice',
    })
    assert.equal(created.ok, true)
    if (!created.ok) return

    const friend = interactOk()
    assert.equal(canInteract('bob', 'alice', friend), true)
    assert.equal(
      canViewAlbum(created.album, {
        viewerUserId: 'bob',
        interact: friend,
      }),
      true,
    )

    const blocked = interactOk({ isBlocked: true })
    assert.equal(canInteract('carol', 'alice', blocked), false)
    assert.equal(
      canViewAlbum(created.album, {
        viewerUserId: 'carol',
        interact: blocked,
      }),
      false,
    )
  })
})
