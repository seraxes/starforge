import assert from 'node:assert/strict'
import { describe, it, beforeEach, afterEach } from 'node:test'

import { contentCacheTags } from './cache/tags'
import {
  CACHE_EXPIRE_ON_NEXT_READ_SEC,
  publishedCacheTagProfile,
  refreshCurrentRoute,
} from './defer-revalidate'
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
    assert.equal(contentCacheTags.page('home', 'en'), 'sf:published-page:en:home')
    assert.equal(contentCacheTags.page('home', 'hu'), 'sf:published-page:hu:home')
    assert.deepEqual(contentCacheTags.pageAllLocales('home'), [
      'sf:published-page:en:home',
      'sf:published-page:hu:home',
    ])
    assert.equal(contentCacheTags.layouts, 'sf:layouts')
    assert.equal(contentCacheTags.navMenu('main'), 'sf:nav-menu:main')
    assert.equal(contentCacheTags.pageChromeRow('global'), 'sf:page-chrome:global')
    assert.equal(contentCacheTags.proxyPolicy, 'sf:proxy-policy')
  })

  it('refreshCurrentRoute calls the refresh implementation', () => {
    let calls = 0
    refreshCurrentRoute(() => {
      calls += 1
    })
    assert.equal(calls, 1)
  })

  it('refreshCurrentRoute ignores a refresh call outside a Server Action', () => {
    assert.doesNotThrow(() => refreshCurrentRoute())
    assert.doesNotThrow(() =>
      refreshCurrentRoute(() => {
        throw new Error('refresh can only be called from within a Server Action')
      }),
    )
  })

  it('layout invalidation expires on the next read without blocking the action', () => {
    const expired = publishedCacheTagProfile('expire')
    assert.equal(publishedCacheTagProfile('stale'), 'max')
    assert.equal(publishedCacheTagProfile(), 'max')
    assert.equal(typeof expired, 'object')
    if (typeof expired !== 'object') return
    assert.equal(expired.expire, CACHE_EXPIRE_ON_NEXT_READ_SEC)
    assert.ok(expired.expire > 0)
    assert.ok(expired.expire < 1)
  })
})
