import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  defaultSocialFriendsConfig,
  readSocialFriendsConfig,
} from './social-friends-config'

describe('readSocialFriendsConfig', () => {
  it('returns defaults for empty config', () => {
    const defaults = defaultSocialFriendsConfig()
    assert.deepEqual(readSocialFriendsConfig(undefined), defaults)
    assert.deepEqual(readSocialFriendsConfig({}), defaults)
  })

  it('keeps valid heading, empty message, and limit', () => {
    assert.deepEqual(
      readSocialFriendsConfig({
        heading: 'My circle',
        emptyMessage: 'Find people on People.',
        limit: 8,
      }),
      {
        heading: 'My circle',
        emptyMessage: 'Find people on People.',
        limit: 8,
      },
    )
  })

  it('falls back when limit is missing, zero, negative, or non-numeric', () => {
    const defaults = defaultSocialFriendsConfig()
    assert.equal(readSocialFriendsConfig({ limit: 0 }).limit, defaults.limit)
    assert.equal(readSocialFriendsConfig({ limit: -3 }).limit, defaults.limit)
    assert.equal(readSocialFriendsConfig({ limit: 'nope' }).limit, defaults.limit)
    assert.equal(readSocialFriendsConfig({ limit: Number.NaN }).limit, defaults.limit)
  })

  it('caps limit at 100 and floors fractional values', () => {
    assert.equal(readSocialFriendsConfig({ limit: 250 }).limit, 100)
    assert.equal(readSocialFriendsConfig({ limit: 7.9 }).limit, 7)
  })

  it('falls back empty message when blank', () => {
    const defaults = defaultSocialFriendsConfig()
    assert.equal(readSocialFriendsConfig({ emptyMessage: '   ' }).emptyMessage, defaults.emptyMessage)
  })
})
