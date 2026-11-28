import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import GlobalError from './global-error'

describe('global-error', () => {
  it('exports a default client error component', () => {
    assert.equal(typeof GlobalError, 'function')
  })

  it('renders recovery UI without digest or stack in the markup', () => {
    const digest = 'DIGEST_SHOULD_NOT_APPEAR_xyz'
    const stackLine = 'at SecretFrame (/secret/path.ts:1:1)'
    const error = Object.assign(new Error('boom for tests'), {
      digest,
      stack: `Error: boom for tests\n    ${stackLine}`,
    })

    const html = renderToStaticMarkup(
      <GlobalError error={error} reset={() => undefined} retry={() => undefined} />,
    )

    assert.match(html, /Something went wrong/)
    assert.match(html, /Try again/)
    assert.match(html, /Back to home/)
    assert.match(html, /<html\b/)
    assert.match(html, /<body\b/)
    assert.doesNotMatch(html, new RegExp(digest))
    assert.doesNotMatch(html, /SecretFrame/)
    assert.doesNotMatch(html, /\/secret\/path\.ts/)
    assert.doesNotMatch(html, /boom for tests/)
  })
})
