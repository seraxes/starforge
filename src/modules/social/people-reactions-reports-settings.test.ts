import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { CanInteractContext } from './interact'
import { createMemberMemory } from './members'
import {
  DEFAULT_SOCIAL_MODULE_SETTINGS,
  decideSocialPackSettings,
  shouldAutoHideFromOpenReports,
} from './pack-settings'
import { createPostRecord, type PostRecord } from './posts'
import {
  DEFAULT_REACTION_ICONS,
  decidePostLike,
  isReactionKindEnabled,
} from './reactions'
import { requestFriendshipWithInteract } from './friends'

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

function publicPost(authorUserId = 'alice'): PostRecord {
  const created = createPostRecord({
    authorUserId,
    body: 'hello',
    audience: 'public',
  })
  assert.equal(created.ok, true)
  if (!created.ok) throw new Error('expected post')
  return created.post
}

describe('social people / reactions / reports settings (slice 15c)', () => {
  it('unban clears bannedAt (success path)', () => {
    const bannedAt = new Date('2026-11-20T22:00:00.000Z')
    const members = createMemberMemory({ now: () => bannedAt })
    const ban = members.ban(
      { actorUserId: 'mod', userId: 'alice' },
      { canManageReports: true },
    )
    assert.equal(ban.ok, true)
    if (!ban.ok) return
    assert.equal(ban.member.bannedAt?.toISOString(), bannedAt.toISOString())

    const unban = members.unban(
      { actorUserId: 'mod', userId: 'alice' },
      { canManageReports: true },
    )
    assert.equal(unban.ok, true)
    if (!unban.ok) return
    assert.equal(unban.member.bannedAt, null)

    const after = createPostRecord(
      { authorUserId: 'alice', body: 'back', audience: 'public' },
      { authorBannedAt: unban.member.bannedAt },
    )
    assert.equal(after.ok, true)

    const saved = decideSocialPackSettings({
      ...DEFAULT_SOCIAL_MODULE_SETTINGS,
      allowFriendRequests: false,
      maxPendingFriendRequests: 3,
      allowFollow: false,
      friendListVisibility: 'only_me',
      enabledReactionKinds: ['like', 'love'],
      reactionIcons: {
        ...DEFAULT_REACTION_ICONS,
        love: 'fa-solid fa-heart-crack',
      },
      reactionIconColors: {
        like: '#0866ff',
        love: '#aabbcc',
        haha: '#f7b125',
        wow: '#f7b125',
        sad: '#f7b125',
        angry: '#e9710f',
      },
      reactionIconMediaIds: {
        like: '',
        love: 'media_love_1',
        haha: '',
        wow: '',
        sad: '',
        angry: '',
      },
      showReactionLabels: false,
      reactionIconSizePx: 24,
      reactionTrayHoverSizePx: 40,
      reactionTrayHoverEasing: 'ease-out',
      allowReactionsOnComments: true,
      allowReactionsOnStories: false,
      enabledReportReasons: ['spam', 'other'],
      autoHideOpenReportThreshold: 5,
      blockedWords: ['spammy', 'BAD'],
    })
    assert.equal(saved.ok, true)
    if (!saved.ok) return
    assert.equal(saved.settings.allowFriendRequests, false)
    assert.equal(saved.settings.maxPendingFriendRequests, 3)
    assert.equal(saved.settings.allowFollow, false)
    assert.equal(saved.settings.friendListVisibility, 'only_me')
    assert.deepEqual(saved.settings.enabledReactionKinds, ['like', 'love'])
    assert.equal(saved.settings.reactionIcons.love, 'fa-solid fa-heart-crack')
    assert.equal(saved.settings.reactionIcons.like, DEFAULT_REACTION_ICONS.like)
    assert.equal(saved.settings.reactionIconColors.love, '#aabbcc')
    assert.equal(saved.settings.reactionIconMediaIds.love, 'media_love_1')
    assert.equal(saved.settings.showReactionLabels, false)
    assert.equal(saved.settings.reactionIconSizePx, 24)
    assert.equal(saved.settings.reactionTrayHoverSizePx, 40)
    assert.equal(saved.settings.reactionTrayHoverEasing, 'ease-out')
    assert.equal(saved.settings.allowReactionsOnComments, true)
    assert.deepEqual(saved.settings.enabledReportReasons, ['spam', 'other'])
    assert.equal(saved.settings.autoHideOpenReportThreshold, 5)
    assert.deepEqual(saved.settings.blockedWords, ['spammy', 'bad'])
    assert.equal(shouldAutoHideFromOpenReports(5, 5), true)
    assert.equal(shouldAutoHideFromOpenReports(4, 5), false)
    assert.equal(shouldAutoHideFromOpenReports(1, 0), false)

    assert.equal(
      isReactionKindEnabled('love', saved.settings.enabledReactionKinds),
      true,
    )
    const liked = decidePostLike(
      null,
      { actorUserId: 'bob', postId: publicPost().id, kind: 'love' },
      { canView: true, canInteract: true },
      { enabledKinds: saved.settings.enabledReactionKinds },
    )
    assert.equal(liked.ok, true)
  })

  it('refuses a disabled reaction kind (failure path)', () => {
    const post = publicPost()
    assert.equal(isReactionKindEnabled('angry', ['like']), false)
    assert.deepEqual(
      decidePostLike(
        null,
        { actorUserId: 'bob', postId: post.id, kind: 'angry' },
        { canView: true, canInteract: true },
        { enabledKinds: ['like'] },
      ),
      { ok: false, reason: 'disabled_kind' },
    )

    const blockedWord = createPostRecord(
      { authorUserId: 'alice', body: 'this is spammy text' },
      { blockedWords: ['spammy'] },
    )
    assert.deepEqual(blockedWord, { ok: false, reason: 'blocked_word' })

    assert.deepEqual(
      requestFriendshipWithInteract(
        null,
        'alice',
        'bob',
        interactCtx(),
        { allowFriendRequests: false },
      ),
      { ok: false, reason: 'disabled' },
    )

    // Blocked-user case on a relationship write.
    assert.deepEqual(
      requestFriendshipWithInteract(
        null,
        'alice',
        'bob',
        interactCtx({ isBlocked: true }),
      ),
      { ok: false, reason: 'blocked' },
    )
  })
})
