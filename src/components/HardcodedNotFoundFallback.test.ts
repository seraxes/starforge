import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { HARDCODED_NOT_FOUND_PAGE } from './HardcodedNotFoundFallback'

describe('HardcodedNotFoundFallback', () => {
  it('exposes a stable last-resort page marker', () => {
    assert.equal(HARDCODED_NOT_FOUND_PAGE, 'not-found-hardcoded')
  })

  it('marker is not a skin outline id', () => {
    assert.ok(!HARDCODED_NOT_FOUND_PAGE.endsWith('-not-found'))
  })
})
