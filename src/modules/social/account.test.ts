import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  SOCIAL_ACCOUNT_REGISTRY,
  SOCIAL_ACCOUNT_TABLE_NAMES,
  createAccountMemory,
  listRegisteredSocialAccountTables,
  listSfSocialTablesFromSchemaSource,
} from './account'
import { canInteract, type CanInteractContext } from './interact'
import { canViewPost, type CanViewPostContext, type PostRecord } from './posts'

const schemaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'schema.ts')

function interactCtx(
  overrides: Partial<CanInteractContext> = {},
): CanInteractContext {
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

function samplePost(overrides: Partial<PostRecord> = {}): PostRecord {
  const now = new Date('2026-11-20T12:00:00.000Z')
  return {
    id: 'post-1',
    authorUserId: 'alice',
    body: 'hello',
    kind: 'text',
    audience: 'public',
    groupId: null,
    pageId: null,
    staffHidden: false,
    isAnnouncement: false,
    editedAt: null,
    extensions: {},
    media: [],
    sharedPostId: null,
    linkUrl: null,
    linkTitle: null,
    linkDescription: null,
    linkImageUrl: null,
    pollOptions: [],
    pollClosedAt: null,
    placeLabel: null,
    mapsPinId: null,
    placeLat: null,
    placeLng: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('social account doors', () => {
  it('hide keeps the rows (success path)', () => {
    const now = () => new Date('2026-11-20T12:00:00.000Z')
    const mem = createAccountMemory({ now })
    mem.seedPost(samplePost())
    mem.seedFriendship({
      id: 'f-1',
      requesterId: 'alice',
      addresseeId: 'bob',
      pairLow: 'alice',
      pairHigh: 'bob',
      status: 'accepted',
      blockedBy: null,
      blockedByOther: null,
      createdAt: now(),
      updatedAt: now(),
    })
    mem.seedComment({
      id: 'c-1',
      postId: 'post-1',
      authorUserId: 'alice',
      body: 'note',
      parentCommentId: null,
      staffHidden: false,
      editedAt: null,
      createdAt: now(),
      updatedAt: now(),
    })
    mem.seedReaction({
      id: 'r-1',
      actorUserId: 'alice',
      targetType: 'post',
      targetId: 'post-1',
      kind: 'like',
      createdAt: now(),
      updatedAt: now(),
    })
    mem.seedReport({
      id: 'rpt-1',
      postId: 'post-1',
      commentId: null,
      reporterUserId: 'alice',
      reason: 'spam',
      note: null,
      status: 'open',
      createdAt: now(),
      updatedAt: now(),
    })
    mem.seedPostMedia({
      id: 'pm-1',
      postId: 'post-1',
      mediaId: 'media-1',
      role: 'attachment',
      sortOrder: 0,
      mimeType: 'image/jpeg',
      createdAt: now(),
    })

    const beforePosts = mem.countOwnedPosts('alice')
    const beforeFriends = mem.countOwnedFriendships('alice')
    assert.equal(beforePosts, 1)
    assert.equal(beforeFriends, 1)

    const result = mem.hideOwned({ userId: 'alice' })
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.purged, false)
    assert.equal(result.member.hiddenAt?.toISOString(), now().toISOString())

    // Rows stay after hide.
    assert.equal(mem.countOwnedPosts('alice'), beforePosts)
    assert.equal(mem.countOwnedFriendships('alice'), beforeFriends)
    assert.equal(mem.bag.comments.size, 1)
    assert.equal(mem.bag.reactions.size, 1)
    assert.equal(mem.bag.reports.size, 1)
    assert.equal(mem.bag.postMedia.size, 1)
    assert.ok(mem.bag.members.get('alice')?.hiddenAt)

    // Hidden author is denied to others; author still sees own post.
    assert.equal(
      canViewPost(samplePost(), viewCtx({ viewerUserId: 'bob', authorHidden: true })),
      false,
    )
    assert.equal(
      canViewPost(
        samplePost(),
        viewCtx({ viewerUserId: 'alice', authorHidden: true }),
      ),
      true,
    )

    const exported = mem.exportOwn('alice')
    assert.ok(exported)
    assert.equal(exported!.tables.sf_social_posts.length, 1)
    assert.equal(exported!.tables.sf_social_members.length, 1)
  })

  it('the member action does not call purge (failure path)', () => {
    const now = () => new Date('2026-11-20T13:00:00.000Z')
    let purgeCalls = 0
    let hideCalls = 0
    const mem = createAccountMemory({
      now,
      onPurge: () => {
        purgeCalls += 1
      },
      onHide: () => {
        hideCalls += 1
      },
    })
    mem.seedPost(samplePost({ id: 'post-keep' }))
    mem.seedFriendship({
      id: 'f-keep',
      requesterId: 'alice',
      addresseeId: 'carol',
      pairLow: 'alice',
      pairHigh: 'carol',
      status: 'accepted',
      blockedBy: null,
      blockedByOther: null,
      createdAt: now(),
      updatedAt: now(),
    })

    // Member door = hideOwnedSocialContent only.
    const hide = mem.hideOwned({ userId: 'alice' })
    assert.equal(hide.ok, true)
    assert.equal(hideCalls, 1)
    assert.equal(purgeCalls, 0)
    assert.equal(mem.countOwnedPosts('alice'), 1)
    assert.equal(mem.countOwnedFriendships('alice'), 1)

    // Staff member flow is refused and still does not purge.
    const staff = mem.hideOwned({ userId: 'staff-1', isStaff: true })
    assert.deepEqual(staff, { ok: false, reason: 'staff_account' })
    assert.equal(purgeCalls, 0)

    // Purge is a separate door — calling it does remove rows.
    const purged = mem.purgeOwn({ userId: 'alice' })
    assert.equal(purged.ok, true)
    if (!purged.ok) return
    assert.equal(purged.purged, true)
    assert.equal(purgeCalls, 1)
    assert.equal(mem.countOwnedPosts('alice'), 0)
    assert.equal(mem.countOwnedFriendships('alice'), 0)
    assert.equal(mem.bag.members.has('alice'), false)
  })

  it('every sf_social_* table in schema.ts is in the registry', () => {
    const source = readFileSync(schemaPath, 'utf8')
    const fromSchema = listSfSocialTablesFromSchemaSource(source)
    const registered = listRegisteredSocialAccountTables().slice().sort()

    assert.deepEqual(fromSchema, registered)
    assert.deepEqual([...SOCIAL_ACCOUNT_TABLE_NAMES].sort(), registered)

    for (const table of fromSchema) {
      const handlers = SOCIAL_ACCOUNT_REGISTRY.find((row) => row.table === table)
      assert.ok(handlers, `missing registry entry for ${table}`)
      assert.equal(typeof handlers!.exportRows, 'function')
      assert.equal(typeof handlers!.hide, 'function')
      assert.equal(typeof handlers!.purge, 'function')
    }
  })

  it('refuses canInteract when the pair is blocked (blocked-user case)', () => {
    assert.equal(
      canInteract('bob', 'alice', interactCtx({ isBlocked: true, otherHidden: true })),
      false,
    )
  })
})
