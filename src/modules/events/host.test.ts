import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  SOCIAL_EVENTS_HOST_MODULE,
  buildHostedEventCreateHref,
  parseEventHost,
  resolveSocialEventHost,
} from './host'

describe('event hosting for Social', () => {
  it('resolves a Social group host (success path)', () => {
    const result = resolveSocialEventHost({
      hostKind: 'group',
      hostId: 'grp-alpha',
    })
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.deepEqual(result.host, {
      hostModule: SOCIAL_EVENTS_HOST_MODULE,
      hostKind: 'group',
      hostId: 'grp-alpha',
    })
    assert.equal(
      buildHostedEventCreateHref(result.host),
      '/admin/events?create=1&hostModule=product%3Asocial&hostKind=group&hostId=grp-alpha',
    )
  })

  it('refuses a Social host when host id is missing', () => {
    const result = resolveSocialEventHost({
      hostKind: 'page',
      hostId: '   ',
    })
    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error, 'Host id is required.')
  })

  it('treats an all-empty host as standalone', () => {
    const result = parseEventHost({
      hostModule: '',
      hostKind: '',
      hostId: '',
    })
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.host, null)
  })
})
