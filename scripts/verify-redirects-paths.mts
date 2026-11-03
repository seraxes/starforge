/**
 * Smoke check: redirect path normalization (SF-130).
 * Run: npx tsx scripts/verify-redirects-paths.mts
 */
import {
  normalizeRedirectFromPath,
  normalizeRedirectToPath,
  resolveRedirectDestination,
} from '../src/core/redirects/paths.ts'

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) {
    console.error(message)
    process.exit(1)
  }
}

assert(normalizeRedirectFromPath('/old/') === '/old', 'strip trailing slash')
assert(normalizeRedirectFromPath('old') === '/old', 'add leading slash')
assert(normalizeRedirectFromPath('/a//b') === '/a/b', 'collapse slashes')
assert(normalizeRedirectFromPath('/x?y=1#z') === '/x', 'strip query/hash')
assert(normalizeRedirectFromPath('/') === '/', 'keep root')
assert(normalizeRedirectFromPath('https://example.com/path/') === '/path', 'from URL → path')

assert(normalizeRedirectToPath('/new/') === '/new', 'to relative')
assert(
  normalizeRedirectToPath('https://example.com/out').startsWith('https://example.com/out'),
  'to absolute https',
)
assert(normalizeRedirectToPath('javascript:alert(1)') === '', 'reject dangerous scheme')
assert(normalizeRedirectToPath('//evil.example/') === '', 'reject protocol-relative')

assert(
  resolveRedirectDestination('/dest', 'http://localhost:3000') ===
    'http://localhost:3000/dest',
  'resolve relative against origin',
)
assert(
  resolveRedirectDestination('https://elsewhere.test/x', 'http://localhost:3000') ===
    'https://elsewhere.test/x',
  'resolve absolute pass-through',
)

console.log('verify-redirects-paths: pass')
