import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { decideCreateChallenge } from './challenge'
import {
  DEFAULT_SOCIAL_MODULE_SETTINGS,
  decideSocialPackSettings,
  isAlbumAtItemCap,
  isChallengeAcceptWindowAllowed,
  isChallengeLengthDaysAllowed,
  SOCIAL_STORY_LIFETIME_HOURS_MAX,
  SOCIAL_STORY_LIFETIME_HOURS_MIN,
} from './pack-settings'
import { decideCreateStory } from './stories'

describe('social stories / albums / media / challenge settings (slice 15e)', () => {
  it('accepts media pack settings within lifetime 1–48 (success path)', () => {
    const saved = decideSocialPackSettings({
      ...DEFAULT_SOCIAL_MODULE_SETTINGS,
      allowStories: true,
      storyLifetimeHours: 36,
      allowAlbums: true,
      maxAlbumItems: 20,
      maxImagesPerPost: 5,
      allowPostVideo: false,
      allowChallenge: true,
      allowChallengeWindow24: true,
      allowChallengeWindow48: false,
      challengeMinLengthDays: 2,
      challengeMaxLengthDays: 5,
      multiChallengeCap: 8,
    })
    assert.equal(saved.ok, true)
    if (!saved.ok) return
    assert.equal(saved.settings.allowStories, true)
    assert.equal(saved.settings.storyLifetimeHours, 36)
    assert.equal(saved.settings.allowAlbums, true)
    assert.equal(saved.settings.maxAlbumItems, 20)
    assert.equal(saved.settings.maxImagesPerPost, 5)
    assert.equal(saved.settings.allowPostVideo, false)
    assert.equal(saved.settings.allowChallengeWindow24, true)
    assert.equal(saved.settings.allowChallengeWindow48, false)
    assert.equal(saved.settings.challengeMinLengthDays, 2)
    assert.equal(saved.settings.challengeMaxLengthDays, 5)
    assert.equal(saved.settings.multiChallengeCap, 8)
    assert.equal(isAlbumAtItemCap(20, 20), true)
    assert.equal(isAlbumAtItemCap(19, 20), false)
    assert.equal(
      isChallengeAcceptWindowAllowed(24, saved.settings),
      true,
    )
    assert.equal(
      isChallengeAcceptWindowAllowed(48, saved.settings),
      false,
    )
    assert.equal(isChallengeLengthDaysAllowed(2, saved.settings), true)
    assert.equal(isChallengeLengthDaysAllowed(1, saved.settings), false)

    const atMin = decideSocialPackSettings({
      ...DEFAULT_SOCIAL_MODULE_SETTINGS,
      storyLifetimeHours: SOCIAL_STORY_LIFETIME_HOURS_MIN,
    })
    assert.equal(atMin.ok, true)
    if (!atMin.ok) return
    assert.equal(atMin.settings.storyLifetimeHours, 1)

    const atMax = decideSocialPackSettings({
      ...DEFAULT_SOCIAL_MODULE_SETTINGS,
      storyLifetimeHours: SOCIAL_STORY_LIFETIME_HOURS_MAX,
    })
    assert.equal(atMax.ok, true)
    if (!atMax.ok) return
    assert.equal(atMax.settings.storyLifetimeHours, 48)

    const story = decideCreateStory(
      { authorUserId: 'alice', mediaId: 'm1' },
      {
        storiesEnabled: true,
        resolveMedia: () => ({ mediaId: 'm1', mimeType: 'image/jpeg' }),
        newId: () => 'story-1',
        now: new Date('2026-11-21T00:00:00.000Z'),
      },
    )
    assert.equal(story.ok, true)

    const challenge = decideCreateChallenge(
      {
        creatorUserId: 'alice',
        acceptWindowHours: 24,
        lengthDays: 3,
      },
      {
        kindEnabled: true,
        windowAllowed: isChallengeAcceptWindowAllowed(24, saved.settings),
        lengthAllowed: isChallengeLengthDaysAllowed(3, saved.settings),
        newId: (() => {
          let n = 0
          return () => `c-${++n}`
        })(),
        now: new Date('2026-11-21T00:00:00.000Z'),
      },
    )
    assert.equal(challenge.ok, true)
  })

  it('refuses a story lifetime outside 1–48 hours (failure path)', () => {
    assert.deepEqual(
      decideSocialPackSettings({
        ...DEFAULT_SOCIAL_MODULE_SETTINGS,
        storyLifetimeHours: 0,
      }),
      { ok: false, reason: 'invalid_story_lifetime' },
    )
    assert.deepEqual(
      decideSocialPackSettings({
        ...DEFAULT_SOCIAL_MODULE_SETTINGS,
        storyLifetimeHours: 49,
      }),
      { ok: false, reason: 'invalid_story_lifetime' },
    )
    assert.deepEqual(
      decideSocialPackSettings({
        ...DEFAULT_SOCIAL_MODULE_SETTINGS,
        storyLifetimeHours: 168,
      }),
      { ok: false, reason: 'invalid_story_lifetime' },
    )
    assert.deepEqual(
      decideSocialPackSettings({
        ...DEFAULT_SOCIAL_MODULE_SETTINGS,
        storyLifetimeHours: -1,
      }),
      { ok: false, reason: 'invalid_story_lifetime' },
    )

    assert.deepEqual(
      decideCreateStory(
        { authorUserId: 'alice', mediaId: 'm1' },
        {
          storiesEnabled: false,
          resolveMedia: () => ({ mediaId: 'm1', mimeType: 'image/jpeg' }),
        },
      ),
      { ok: false, reason: 'disabled' },
    )

    assert.deepEqual(
      decideCreateChallenge(
        {
          creatorUserId: 'alice',
          acceptWindowHours: 48,
          lengthDays: 2,
        },
        {
          kindEnabled: true,
          windowAllowed: false,
          lengthAllowed: true,
        },
      ),
      { ok: false, reason: 'invalid_timing' },
    )
  })
})
