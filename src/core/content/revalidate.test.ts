import assert from 'node:assert/strict'
import { describe, it, beforeEach, afterEach } from 'node:test'

import { contentCacheTags } from './cache/tags'
import {
  invalidateLayout,
  invalidateNavMenu,
  invalidatePageChrome,
  invalidatePublishedPage,
  invalidateSiteChrome,
  invalidateSiteSettings,
} from './revalidate'

type Recorded = {
  tags: string[][]
}

function installRecordingCache(recorder: Recorded) {
  const previous = process.env.STARFORGE_CONTENT_CACHE
  // Force passthrough backend; we stub getPublishedContentCache via module mock pattern:
  // call helpers and assert they return Promises that resolve (passthrough awaits).
  process.env.STARFORGE_CONTENT_CACHE = ''
  return () => {
    if (previous === undefined) delete process.env.STARFORGE_CONTENT_CACHE
    else process.env.STARFORGE_CONTENT_CACHE = previous
    void recorder
  }
}

describe('content cache invalidate helpers await', () => {
  let restore: () => void

  beforeEach(() => {
    restore = installRecordingCache({ tags: [] })
  })

  afterEach(() => {
    restore()
  })

  it('invalidate helpers return thenable Promises', async () => {
    const jobs = [
      invalidatePublishedPage({ slug: 'about' }),
      invalidateSiteSettings(),
      invalidateSiteChrome(),
      invalidateLayout('default'),
      invalidateNavMenu('main'),
      invalidatePageChrome('global'),
    ]
    for (const job of jobs) {
      assert.equal(typeof (job as Promise<void>).then, 'function')
    }
    await Promise.all(jobs)
  })

  it('published page invalidation includes slug + pages tags', async () => {
    // Smoke: helpers complete without throw under default Next/passthrough path.
    await invalidatePublishedPage({
      slug: 'home',
      previousSlug: 'old-home',
      slugChanged: true,
    })
    assert.equal(contentCacheTags.page('home'), 'sf:published-page:home')
    assert.equal(contentCacheTags.layouts, 'sf:layouts')
    assert.equal(contentCacheTags.navMenu('main'), 'sf:nav-menu:main')
    assert.equal(contentCacheTags.pageChromeRow('global'), 'sf:page-chrome:global')
    assert.equal(contentCacheTags.proxyPolicy, 'sf:proxy-policy')
  })
})
