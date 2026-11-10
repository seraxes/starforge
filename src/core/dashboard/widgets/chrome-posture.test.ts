import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  assembleChromePosture,
  formatIndexingPosture,
  indexingDiscouraged,
} from './chrome-posture'

const OPEN_TXT = `User-agent: *
Allow: /

Sitemap: /sitemap.xml
`

describe('chrome posture', () => {
  it('indexing stays open for the default robots body', () => {
    assert.equal(indexingDiscouraged('index, follow', OPEN_TXT), false)
    assert.equal(formatIndexingPosture('index, follow', OPEN_TXT), 'Indexing')
  })

  it('noindex and a full Disallow mark indexing discouraged', () => {
    assert.equal(indexingDiscouraged('noindex, nofollow', OPEN_TXT), true)
    assert.equal(indexingDiscouraged('none', OPEN_TXT), true)
    assert.equal(
      indexingDiscouraged('index, follow', 'User-agent: *\nDisallow: /\n'),
      true,
    )
    assert.equal(
      indexingDiscouraged('index, follow', 'User-agent: *\nDisallow: /admin\n'),
      false,
    )
    assert.equal(
      indexingDiscouraged('index, follow', 'User-agent: *\nDisallow: /\nAllow: /\n'),
      false,
    )
  })

  it('assembleChromePosture warns on offline and discouraged indexing only', () => {
    const rows = assembleChromePosture({
      offlineEnabled: true,
      robotsMeta: 'noindex, nofollow',
      robotsTxt: OPEN_TXT,
      captchaEnabled: true,
      captchaProvider: 'turnstile',
    })
    assert.deepEqual(
      rows.map((row) => ({ key: row.key, value: row.value, warn: row.warn })),
      [
        { key: 'site', value: 'Offline', warn: true },
        { key: 'indexing', value: 'Discouraged', warn: true },
        { key: 'captcha', value: 'Turnstile', warn: false },
      ],
    )
  })
})
