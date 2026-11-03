/**
 * Smoke check: redirect path/URL normalization + blocked prefixes.
 * Run: npx tsx scripts/verify-redirects-normalize.mts
 */
import {
  isBlockedFromPath,
  isRedirectExemptPath,
  normalizeFromPath,
  normalizeStatusCode,
  normalizeToUrl,
} from '../src/core/redirects/normalize.ts'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error(msg)
    process.exit(1)
  }
}

assert(normalizeFromPath('/old') === '/old', 'from /old')
assert(normalizeFromPath('old/') === '/old', 'from old/ → /old')
assert(normalizeFromPath('https://example.com/x?y=1') === '/x', 'from absolute URL')
assert(normalizeFromPath('/admin') === null, 'block /admin')
assert(normalizeFromPath('/api/foo') === null, 'block /api')
assert(normalizeFromPath('/app/admin') === null, 'block /app')
assert(normalizeFromPath('/robots.txt') === null, 'block robots')
assert(normalizeToUrl('/about') === '/about', 'to relative')
assert(normalizeToUrl('https://example.com/a') === 'https://example.com/a', 'to absolute')
assert(normalizeToUrl('//evil') === null, 'reject protocol-relative')
assert(normalizeStatusCode(302) === 302, 'status 302')
assert(normalizeStatusCode('301') === 301, 'status 301 default')
assert(isBlockedFromPath('/login'), 'login blocked')
assert(isRedirectExemptPath('/sitemap.xml'), 'sitemap exempt')

console.log('verify-redirects-normalize: pass')
