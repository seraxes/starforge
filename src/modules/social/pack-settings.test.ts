import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  DEFAULT_SOCIAL_MODULE_SETTINGS,
  SOCIAL_PACK_DISABLED_NOTICE,
  decideSocialPackSettings,
  isActivityCardEnabled,
  normalizeSocialModuleSettings,
  socialPackAdminPage,
  storyLifetimeMs,
} from './pack-settings'
import { STORY_TTL_MS } from './stories'

describe('social pack settings', () => {
  it('accepts a pack settings document (success path)', () => {
    const defaults = decideSocialPackSettings({})
    assert.equal(defaults.ok, true)
    if (!defaults.ok) return
    assert.deepEqual(defaults.settings, DEFAULT_SOCIAL_MODULE_SETTINGS)
    assert.equal(defaults.settings.defaultPostAudience, 'friends')
    assert.equal(defaults.settings.friendListVisibility, 'friends')
    assert.equal(defaults.settings.storyLifetimeHours, 24)
    assert.equal(storyLifetimeMs(defaults.settings.storyLifetimeHours), STORY_TTL_MS)
    assert.equal(socialPackAdminPage(true).mode, 'pack')

    const saved = decideSocialPackSettings({
      defaultPostAudience: 'public',
      friendListVisibility: 'only_me',
      storyLifetimeHours: 48,
      multiChallengeCap: 4,
      activityEventPublished: false,
      activityPagePublished: true,
      enabledReactionKinds: ['love'],
    })
    assert.equal(saved.ok, true)
    if (!saved.ok) return
    assert.equal(saved.settings.defaultPostAudience, 'public')
    assert.equal(saved.settings.friendListVisibility, 'only_me')
    assert.equal(saved.settings.storyLifetimeHours, 48)
    assert.equal(saved.settings.multiChallengeCap, 4)
    assert.equal(saved.settings.activityEventPublished, false)
    assert.equal(saved.settings.activityPagePublished, true)
    assert.deepEqual(saved.settings.enabledReactionKinds, ['like', 'love'])
    assert.equal(isActivityCardEnabled('event.published', saved.settings), false)
    assert.equal(isActivityCardEnabled('page.published', saved.settings), true)

    const loaded = normalizeSocialModuleSettings({
      defaultPostAudience: 'group',
      friendListVisibility: 'only_me',
      storyLifetimeHours: 12,
      multiChallengeCap: 3,
      activityEventPublished: true,
      activityPagePublished: false,
      enabledReactionKinds: ['like', 'wow'],
    })
    assert.equal(loaded.defaultPostAudience, 'group')
    assert.equal(loaded.storyLifetimeHours, 12)
    assert.deepEqual(loaded.enabledReactionKinds, ['like', 'wow'])
  })

  it('refuses an unknown audience and leaves Social off as a disabled notice (failure path)', () => {
    assert.deepEqual(decideSocialPackSettings({ defaultPostAudience: 'followers' }), {
      ok: false,
      reason: 'invalid_audience',
    })
    assert.deepEqual(decideSocialPackSettings({ defaultPostAudience: 'custom' }), {
      ok: false,
      reason: 'invalid_audience',
    })
    assert.deepEqual(
      decideSocialPackSettings({
        defaultPostAudience: 'followers',
        friendListVisibility: 'only_me',
        storyLifetimeHours: 24,
      }),
      { ok: false, reason: 'invalid_audience' },
    )

    const off = socialPackAdminPage(false)
    assert.equal(off.mode, 'disabled-notice')
    if (off.mode !== 'disabled-notice') return
    assert.equal(off.notice, SOCIAL_PACK_DISABLED_NOTICE)
    assert.match(off.notice, /disabled/i)
    assert.equal('settings' in off, false)
  })
})
