/**
 * Smoke checks for awaited invalidateTags + layout/nav/page-chrome tags + Node proxy.
 * Run: npx tsx scripts/verify-redis-cache-await-proxy.mts
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function read(rel: string): string {
  return readFileSync(join(root, rel), 'utf8')
}

assert.equal(existsSync(join(root, 'src/middleware.ts')), false, 'middleware.ts must be removed')
assert.equal(existsSync(join(root, 'src/proxy.ts')), true, 'src/proxy.ts must exist')

const proxy = read('src/proxy.ts')
assert.match(proxy, /export async function proxy/)
assert.match(proxy, /getCachedFeatureCspSources/)
assert.match(proxy, /runProxyHooks/)
assert.doesNotMatch(proxy, /@\/core\/redirects|@\/modules\/redirects/)
assert.match(proxy, /getSiteChrome/)
assert.doesNotMatch(
  proxy,
  /fetch\(\s*new URL\(\s*['"`]\/api\/(security\/csp-sources|site-chrome\/offline-gate|redirects\/lookup)/,
  'proxy must not fetch legacy internal policy APIs',
)
console.log('proxy.ts in-process policy (no internal HTTP hops): ok')

const redis = read('src/core/content/cache/redis.ts')
assert.match(redis, /async invalidateTags/)
assert.doesNotMatch(redis, /void invalidateTagsAsync/)
console.log('Redis invalidateTags awaits (not fire-and-forget): ok')

const types = read('src/core/content/cache/types.ts')
assert.match(types, /invalidateTags\(tags: readonly string\[\]\): void \| Promise<void>/)
console.log('PublishedContentCache.invalidateTags Promise contract: ok')

const revalidate = read('src/core/content/revalidate.ts')
assert.match(revalidate, /export async function invalidatePublishedPage/)
assert.match(revalidate, /export async function invalidateLayout/)
assert.match(revalidate, /export async function invalidateNavMenu/)
assert.match(revalidate, /export async function invalidatePageChrome/)
assert.match(revalidate, /contentCacheTags\.proxyPolicy/)
console.log('revalidate helpers async + proxyPolicy: ok')

const tags = read('src/core/content/cache/tags.ts')
for (const name of ['layouts', 'navMenus', 'pageChrome', 'proxyPolicy']) {
  assert.match(tags, new RegExp(name))
}
console.log('cache tags for layout/nav/page-chrome/proxy: ok')

const layout = read('src/core/modules/layout.ts')
assert.match(layout, /getPublishedContentCache\(\)\.getCached/)
assert.match(layout, /contentCacheTags\.layout/)
console.log('getLayoutDocument cached: ok')

const navStore = read('src/core/nav/store.ts')
assert.match(navStore, /export async function getCachedNavMenu/)
assert.match(navStore, /await invalidateNavMenu/)
const navResolve = read('src/core/nav/resolve.ts')
assert.match(navResolve, /getCachedNavMenu/)
console.log('nav menu cache + invalidate: ok')

const pageChrome = read('src/core/page-settings/store.ts')
assert.match(pageChrome, /getPublishedContentCache\(\)\.getCached/)
assert.match(pageChrome, /await invalidatePageChrome/)
console.log('page chrome cache + invalidate: ok')

const pages = read('src/collections/Pages.ts')
assert.match(pages, /await invalidatePublishedPage/)
const siteSettings = read('src/globals/SiteSettings.ts')
assert.match(siteSettings, /await invalidateSiteSettings/)
console.log('Payload hooks await invalidate: ok')

console.log('verify-redis-cache-await-proxy: all ok')
