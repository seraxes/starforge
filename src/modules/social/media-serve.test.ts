import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  canViewBoundMedia,
  mediaBindIsRestricted,
  mediaAccessLevelFromFacts,
  type BoundMediaOwner,
  type CanViewPostContext,
} from './posts'

function baseCtx(overrides: Partial<CanViewPostContext> = {}): CanViewPostContext {
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

describe('canViewBoundMedia (serve)', () => {
  it('allows a public bind for any viewer (success path)', () => {
    const owning: BoundMediaOwner = {
      authorUserId: 'alice',
      audience: 'public',
    }
    const level = mediaAccessLevelFromFacts({
      binds: [{ audience: 'public' }],
    })
    assert.equal(level.audience, 'public')
    assert.equal(mediaBindIsRestricted(level), false)
    assert.equal(canViewBoundMedia(owning, baseCtx({ viewerUserId: null })), true)
    assert.equal(canViewBoundMedia(owning, baseCtx({ viewerUserId: 'carol' })), true)
  })

  it('allows a friends-only bind for a viewer who can see that post (success path)', () => {
    const owning: BoundMediaOwner = {
      authorUserId: 'alice',
      audience: 'friends',
    }
    assert.equal(
      canViewBoundMedia(
        owning,
        baseCtx({ viewerUserId: 'bob', areFriends: true }),
      ),
      true,
    )
    assert.equal(
      canViewBoundMedia(owning, baseCtx({ viewerUserId: 'alice' })),
      true,
    )
  })

  it('denies a friends-only bind for a stranger (failure path)', () => {
    const owning: BoundMediaOwner = {
      authorUserId: 'alice',
      audience: 'friends',
    }
    const level = mediaAccessLevelFromFacts({
      binds: [{ audience: 'friends' }],
    })
    assert.equal(mediaBindIsRestricted(level), true)
    assert.equal(
      canViewBoundMedia(
        owning,
        baseCtx({ viewerUserId: 'stranger', areFriends: false }),
      ),
      false,
    )
    assert.equal(
      canViewBoundMedia(owning, baseCtx({ viewerUserId: null })),
      false,
    )
  })

  it('denies an only_me bind for anyone except the author (failure path)', () => {
    const owning: BoundMediaOwner = {
      authorUserId: 'alice',
      audience: 'only_me',
    }
    assert.equal(
      canViewBoundMedia(owning, baseCtx({ viewerUserId: 'alice' })),
      true,
    )
    assert.equal(
      canViewBoundMedia(
        owning,
        baseCtx({ viewerUserId: 'bob', areFriends: true }),
      ),
      false,
    )
    assert.equal(
      canViewBoundMedia(owning, baseCtx({ viewerUserId: null })),
      false,
    )
  })
})
