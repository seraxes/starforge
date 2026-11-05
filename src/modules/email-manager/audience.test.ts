import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  normalizeEmailAudience,
  resolveEmailAudience,
  splitEmailList,
} from './audience'

describe('splitEmailList', () => {
  it('splits and lowercases unique emails', () => {
    assert.deepEqual(splitEmailList(['A@B.C, d@e.f', 'a@b.c']), ['a@b.c', 'd@e.f'])
  })

  it('drops invalid entries', () => {
    assert.deepEqual(splitEmailList(['not-an-email', 'ok@x.y']), ['ok@x.y'])
  })
})

describe('resolveEmailAudience', () => {
  it('merges literals and payload paths', () => {
    const resolved = resolveEmailAudience(
      {
        to: ['static@x.y'],
        toFromPayload: ['adminEmails', 'respondentEmail'],
      },
      {
        adminEmails: ['a@b.c', 'bad'],
        respondentEmail: 'r@s.t',
      },
    )
    assert.deepEqual(resolved.to.sort(), ['a@b.c', 'r@s.t', 'static@x.y'])
  })

  it('resolves reply-to from payload', () => {
    const resolved = resolveEmailAudience(
      { to: ['a@b.c'], replyToFromPayload: 'respondentEmail' },
      { respondentEmail: 'Reply@X.Y' },
    )
    assert.equal(resolved.replyTo, 'reply@x.y')
  })
})

describe('normalizeEmailAudience', () => {
  it('trims paths and emails', () => {
    const a = normalizeEmailAudience({
      to: ['  A@B.C '],
      toFromPayload: [' adminEmails ', ''],
    })
    assert.deepEqual(a.to, ['a@b.c'])
    assert.deepEqual(a.toFromPayload, ['adminEmails'])
  })
})
