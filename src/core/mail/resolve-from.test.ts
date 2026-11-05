import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { resolveFrom } from './resolve-from'

describe('resolveFrom chromeFrom guard', () => {
  it('does not throw when chromeFrom is undefined or null', () => {
    const prev = process.env.STARFORGE_MAIL_FROM
    delete process.env.STARFORGE_MAIL_FROM
    try {
      assert.equal(resolveFrom(undefined), '')
      assert.equal(resolveFrom(null), '')
    } finally {
      if (prev === undefined) delete process.env.STARFORGE_MAIL_FROM
      else process.env.STARFORGE_MAIL_FROM = prev
    }
  })

  it('prefers non-empty chrome From over env', () => {
    const prev = process.env.STARFORGE_MAIL_FROM
    process.env.STARFORGE_MAIL_FROM = 'env@example.com'
    try {
      assert.equal(resolveFrom('  chrome@example.com  '), 'chrome@example.com')
      assert.equal(resolveFrom(undefined), 'env@example.com')
      assert.equal(resolveFrom(''), 'env@example.com')
      assert.equal(resolveFrom('   '), 'env@example.com')
    } finally {
      if (prev === undefined) delete process.env.STARFORGE_MAIL_FROM
      else process.env.STARFORGE_MAIL_FROM = prev
    }
  })
})
