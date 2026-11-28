import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  canViewPostContextFromFeedFacts,
  loadThenFilterHomeFeedPage,
  matchesCanViewPostPredicate,
  selectHomeFeedPageByPredicate,
  type HomeFeedVisibilityFacts,
} from './feed'
import {
  canViewPost,
  createPostRecord,
  type PostRecord,
} from './posts'

function textPost(
  overrides: Partial<PostRecord> & {
    authorUserId: string
    audience: PostRecord['audience']
    body?: string
  },
): PostRecord {
  const created = createPostRecord({
    authorUserId: overrides.authorUserId,
    body: overrides.body ?? 'hello',
    audience: overrides.audience,
    groupId: overrides.groupId,
    pageId: overrides.pageId,
  })
  assert.equal(created.ok, true)
  if (!created.ok) throw new Error('expected post')
  return {
    ...created.post,
    ...overrides,
    createdAt: overrides.createdAt ?? created.post.createdAt,
  }
}

function facts(
  overrides: Partial<HomeFeedVisibilityFacts> = {},
): HomeFeedVisibilityFacts {
  return {
    friendIds: new Set(['bob']),
    blockedPeerIds: new Set(),
    hiddenAuthorIds: new Set(),
    ...overrides,
  }
}

function assertParity(
  post: PostRecord,
  viewerUserId: string | null,
  feedFacts: HomeFeedVisibilityFacts,
) {
  const viaCanView = canViewPost(
    post,
    canViewPostContextFromFeedFacts(post, viewerUserId, feedFacts),
  )
  const viaPredicate = matchesCanViewPostPredicate(post, viewerUserId, feedFacts)
  assert.equal(
    viaPredicate,
    viaCanView,
    `parity mismatch for audience=${post.audience} author=${post.authorUserId} viewer=${viewerUserId}`,
  )
}

describe('feed query canViewPost SQL predicate parity', () => {
  it('matches canViewPost for audience, friendship, block, and hidden author (success path)', () => {
    const base = facts()

    // Audience: only_me — author yes, other no
    assertParity(textPost({ authorUserId: 'alice', audience: 'only_me' }), 'alice', base)
    assertParity(textPost({ authorUserId: 'alice', audience: 'only_me' }), 'bob', base)

    // Audience: friends — friend yes, stranger no
    assertParity(
      textPost({ authorUserId: 'bob', audience: 'friends' }),
      'alice',
      facts({ friendIds: new Set(['bob']) }),
    )
    assertParity(
      textPost({ authorUserId: 'carol', audience: 'friends' }),
      'alice',
      facts({ friendIds: new Set(['bob']) }),
    )

    // Audience: public
    assertParity(textPost({ authorUserId: 'bob', audience: 'public' }), 'alice', base)
    assertParity(textPost({ authorUserId: 'bob', audience: 'public' }), null, base)

    // Audience: group — membership set input (slice 13 replaces lookup)
    assertParity(
      textPost({ authorUserId: 'bob', audience: 'group', groupId: 'g1' }),
      'alice',
      facts({ memberGroupIds: new Set(['g1']) }),
    )
    assertParity(
      textPost({ authorUserId: 'bob', audience: 'group', groupId: 'g1' }),
      'alice',
      facts({ memberGroupIds: new Set() }),
    )

    // Page posts — liker / admin sets (slice 15)
    assertParity(
      textPost({
        authorUserId: 'bob',
        audience: 'public',
        pageId: 'p1',
      }),
      'alice',
      facts({ likedPageIds: new Set(['p1']) }),
    )
    assertParity(
      textPost({
        authorUserId: 'bob',
        audience: 'public',
        pageId: 'p1',
      }),
      'alice',
      facts({ adminPageIds: new Set(['p1']) }),
    )
    assertParity(
      textPost({
        authorUserId: 'bob',
        audience: 'public',
        pageId: 'p1',
      }),
      'alice',
      facts({ likedPageIds: new Set(), adminPageIds: new Set() }),
    )

    // Friendship
    assertParity(
      textPost({ authorUserId: 'bob', audience: 'friends' }),
      'alice',
      facts({ friendIds: new Set(['bob']) }),
    )
    assertParity(
      textPost({ authorUserId: 'bob', audience: 'friends' }),
      'alice',
      facts({ friendIds: new Set() }),
    )

    // Block (either blocker column → blockedPeerIds)
    assertParity(
      textPost({ authorUserId: 'bob', audience: 'public' }),
      'alice',
      facts({ blockedPeerIds: new Set(['bob']) }),
    )
    assertParity(
      textPost({ authorUserId: 'bob', audience: 'friends' }),
      'alice',
      facts({ friendIds: new Set(['bob']), blockedPeerIds: new Set(['bob']) }),
    )

    // Hidden author — others denied; author still sees own
    assertParity(
      textPost({ authorUserId: 'bob', audience: 'public' }),
      'alice',
      facts({ hiddenAuthorIds: new Set(['bob']) }),
    )
    assertParity(
      textPost({ authorUserId: 'bob', audience: 'public' }),
      'bob',
      facts({ hiddenAuthorIds: new Set(['bob']) }),
    )

    // Staff private-read — only_me / friends / non-member group
    assertParity(
      textPost({ authorUserId: 'carol', audience: 'only_me' }),
      'alice',
      facts({ canManagePosts: true }),
    )
    assertParity(
      textPost({ authorUserId: 'carol', audience: 'friends' }),
      'alice',
      facts({ friendIds: new Set(), canManagePosts: true }),
    )
    assertParity(
      textPost({ authorUserId: 'carol', audience: 'group', groupId: 'g9' }),
      'alice',
      facts({ memberGroupIds: new Set(), canManagePosts: true }),
    )
    assertParity(
      textPost({ authorUserId: 'carol', audience: 'only_me' }),
      'alice',
      facts({ canManagePosts: false }),
    )
    // Block / author-hidden still deny staff
    assertParity(
      textPost({ authorUserId: 'carol', audience: 'only_me' }),
      'alice',
      facts({ canManagePosts: true, blockedPeerIds: new Set(['carol']) }),
    )
    assertParity(
      textPost({ authorUserId: 'carol', audience: 'friends' }),
      'alice',
      facts({
        friendIds: new Set(),
        canManagePosts: true,
        hiddenAuthorIds: new Set(['carol']),
      }),
    )
  })

  it('excludes viewer-hidden posts and muted authors before LIMIT (success path)', () => {
    const bobVisible = textPost({
      authorUserId: 'bob',
      audience: 'friends',
      body: 'visible',
      createdAt: new Date(Date.UTC(2026, 10, 28, 12, 0, 2)),
    })
    const bobHidden = textPost({
      authorUserId: 'bob',
      audience: 'friends',
      body: 'hidden by viewer',
      createdAt: new Date(Date.UTC(2026, 10, 28, 12, 0, 1)),
    })
    const carolMuted = textPost({
      authorUserId: 'carol',
      audience: 'friends',
      body: 'muted author',
      createdAt: new Date(Date.UTC(2026, 10, 28, 12, 0, 0)),
    })

    // canViewPost parity still holds (hide/mute are feed-only cuts).
    assertParity(
      bobHidden,
      'alice',
      facts({
        friendIds: new Set(['bob', 'carol']),
        hiddenPostIds: new Set([bobHidden.id]),
      }),
    )

    const page = selectHomeFeedPageByPredicate(
      [bobVisible, bobHidden, carolMuted],
      'alice',
      facts({
        friendIds: new Set(['bob', 'carol']),
        hiddenPostIds: new Set([bobHidden.id]),
        mutedAuthorIds: new Set(['carol']),
      }),
      10,
    )
    assert.equal(page.length, 1)
    assert.equal(page[0]!.id, bobVisible.id)

    // Full page without over-fetch drop when muted posts dominate the newest window.
    const flooded: PostRecord[] = []
    for (let i = 0; i < 20; i += 1) {
      flooded.push(
        textPost({
          authorUserId: 'carol',
          audience: 'friends',
          body: `muted-${i}`,
          createdAt: new Date(Date.UTC(2026, 10, 28, 13, 0, 40 - i)),
        }),
      )
    }
    for (let i = 0; i < 5; i += 1) {
      flooded.push(
        textPost({
          authorUserId: 'bob',
          audience: 'friends',
          body: `keep-${i}`,
          createdAt: new Date(Date.UTC(2026, 10, 28, 11, 0, 40 - i)),
        }),
      )
    }
    const shortPage = loadThenFilterHomeFeedPage(
      flooded,
      'alice',
      facts({
        friendIds: new Set(['bob', 'carol']),
        mutedAuthorIds: new Set(['carol']),
      }),
      5,
      3,
    )
    assert.ok(shortPage.length < 5, `expected short page, got ${shortPage.length}`)
    const fullPage = selectHomeFeedPageByPredicate(
      flooded,
      'alice',
      facts({
        friendIds: new Set(['bob', 'carol']),
        mutedAuthorIds: new Set(['carol']),
      }),
      5,
    )
    assert.equal(fullPage.length, 5)
    assert.ok(fullPage.every((post) => post.authorUserId === 'bob'))
  })
})

describe('feed query pagination', () => {
  it('returns a full page when load-then-filter comes back short (failure path)', () => {
    const viewer = 'alice'
    const feedFacts = facts({
      friendIds: new Set(['bob', 'hidden-friend']),
      blockedPeerIds: new Set(),
      hiddenAuthorIds: new Set(['hidden-friend']),
    })
    const limit = 5

    // Newest first: many denied (hidden author) then enough visible friend posts.
    const posts: PostRecord[] = []
    for (let i = 0; i < 20; i += 1) {
      posts.push(
        textPost({
          authorUserId: 'hidden-friend',
          audience: 'friends',
          body: `hidden-${i}`,
          createdAt: new Date(Date.UTC(2026, 10, 20, 12, 0, 40 - i)),
        }),
      )
    }
    for (let i = 0; i < limit; i += 1) {
      posts.push(
        textPost({
          authorUserId: 'bob',
          audience: 'friends',
          body: `visible-${i}`,
          createdAt: new Date(Date.UTC(2026, 10, 20, 11, 0, 40 - i)),
        }),
      )
    }

    const shortPage = loadThenFilterHomeFeedPage(posts, viewer, feedFacts, limit, 3)
    assert.ok(
      shortPage.length < limit,
      `expected load-then-filter short page, got ${shortPage.length}`,
    )

    const fullPage = selectHomeFeedPageByPredicate(posts, viewer, feedFacts, limit)
    assert.equal(fullPage.length, limit)
    assert.ok(fullPage.every((post) => post.authorUserId === 'bob'))
  })
})
