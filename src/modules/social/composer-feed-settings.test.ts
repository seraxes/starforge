import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  DEFAULT_SOCIAL_MODULE_SETTINGS,
  decideSocialPackSettings,
  isComposerPostKindEnabled,
} from './pack-settings'
import { canViewPost, createPostRecord } from './posts'
import { decideCreateLinkPost } from './share-links'
import { decideCreatePollPost } from './polls-checkin'

describe('social composer and feed settings (slice 15b)', () => {
  it('accepts composer/feed pack settings and creates an enabled kind (success path)', () => {
    const saved = decideSocialPackSettings({
      defaultPostAudience: 'public',
      guestCanReadPublic: true,
      feedPageSize: 25,
      allowText: true,
      allowMedia: false,
      allowLink: true,
      allowShare: false,
      allowPoll: true,
      allowCheckin: false,
      allowChallenge: true,
      allowMentions: true,
      allowHashtags: false,
      allowComments: true,
      allowDiscover: false,
      allowFollowingTab: true,
      allowShortVideoLayout: false,
      commentLengthLimit: 1000,
      holdNewPostsForReview: true,
    })
    assert.equal(saved.ok, true)
    if (!saved.ok) return
    assert.equal(saved.settings.defaultPostAudience, 'public')
    assert.equal(saved.settings.guestCanReadPublic, true)
    assert.equal(saved.settings.feedPageSize, 25)
    assert.equal(saved.settings.allowText, true)
    assert.equal(saved.settings.allowMedia, false)
    assert.equal(saved.settings.allowDiscover, false)
    assert.equal(saved.settings.holdNewPostsForReview, true)
    assert.equal(saved.settings.commentLengthLimit, 1000)
    assert.equal(isComposerPostKindEnabled('text', saved.settings), true)
    assert.equal(isComposerPostKindEnabled('media', saved.settings), false)

    const created = createPostRecord(
      { authorUserId: 'alice', body: 'hello' },
      {
        isKindEnabled: (kind) => isComposerPostKindEnabled(kind, saved.settings),
        holdForStaffReview: saved.settings.holdNewPostsForReview,
        newId: () => 'post-ok',
      },
    )
    assert.equal(created.ok, true)
    if (!created.ok) return
    assert.equal(created.post.kind, 'text')
    assert.equal(created.post.staffHidden, true)

    // Hold-for-review left staffHidden true — clear it for the guest-read checks.
    const publicPost = {
      ...created.post,
      audience: 'public' as const,
      staffHidden: false,
    }
    assert.equal(
      canViewPost(publicPost, {
        viewerUserId: null,
        areFriends: false,
        isBlocked: false,
        authorHidden: false,
        isGroupMember: false,
        isPageLiker: false,
        isPageAdmin: false,
        canManagePosts: false,
        guestCanReadPublic: true,
      }),
      true,
    )
    assert.equal(
      canViewPost(publicPost, {
        viewerUserId: null,
        areFriends: false,
        isBlocked: false,
        authorHidden: false,
        isGroupMember: false,
        isPageLiker: false,
        isPageAdmin: false,
        canManagePosts: false,
        guestCanReadPublic: false,
      }),
      false,
    )

    const defaults = decideSocialPackSettings({})
    assert.equal(defaults.ok, true)
    if (!defaults.ok) return
    assert.deepEqual(
      {
        guestCanReadPublic: defaults.settings.guestCanReadPublic,
        feedPageSize: defaults.settings.feedPageSize,
        allowText: defaults.settings.allowText,
        holdNewPostsForReview: defaults.settings.holdNewPostsForReview,
      },
      {
        guestCanReadPublic: DEFAULT_SOCIAL_MODULE_SETTINGS.guestCanReadPublic,
        feedPageSize: DEFAULT_SOCIAL_MODULE_SETTINGS.feedPageSize,
        allowText: DEFAULT_SOCIAL_MODULE_SETTINGS.allowText,
        holdNewPostsForReview: DEFAULT_SOCIAL_MODULE_SETTINGS.holdNewPostsForReview,
      },
    )
  })

  it('refuses an unknown audience and a disabled post kind (failure path)', () => {
    assert.deepEqual(decideSocialPackSettings({ defaultPostAudience: 'followers' }), {
      ok: false,
      reason: 'invalid_audience',
    })

    const settings = {
      ...DEFAULT_SOCIAL_MODULE_SETTINGS,
      allowText: false,
      allowMedia: true,
      allowLink: false,
      allowPoll: false,
    }

    assert.equal(isComposerPostKindEnabled('text', settings), false)
    assert.deepEqual(
      createPostRecord(
        { authorUserId: 'alice', body: 'nope' },
        {
          isKindEnabled: (kind) => isComposerPostKindEnabled(kind, settings),
          newId: () => 'post-denied',
        },
      ),
      { ok: false, reason: 'disabled_kind' },
    )

    assert.deepEqual(
      decideCreateLinkPost(
        { authorUserId: 'alice', url: 'https://example.com' },
        { kindEnabled: false },
      ),
      { ok: false, reason: 'disabled_kind' },
    )

    assert.deepEqual(
      decideCreatePollPost(
        { authorUserId: 'alice', options: ['A', 'B'] },
        { kindEnabled: false },
      ),
      { ok: false, reason: 'disabled_kind' },
    )
  })
})
