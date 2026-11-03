/**
 * Smoke check: public search query helpers (SF-132).
 * Run: npm run verify:search-query
 */
import {
  SEARCH_QUERY_MAX_LENGTH,
  normalizeSearchQuery,
  publishedPagePath,
} from '../src/core/content/search-query.ts'

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) {
    console.error(message)
    process.exit(1)
  }
}

assert(normalizeSearchQuery(null) === '', 'null → empty')
assert(normalizeSearchQuery('  hello  ') === 'hello', 'trim')
assert(normalizeSearchQuery(12) === '', 'non-string → empty')

const long = 'x'.repeat(SEARCH_QUERY_MAX_LENGTH + 40)
assert(
  normalizeSearchQuery(long).length === SEARCH_QUERY_MAX_LENGTH,
  'cap length',
)

assert(publishedPagePath('home') === '/', 'home → /')
assert(publishedPagePath('/about') === '/about', 'strip leading slash')
assert(publishedPagePath('docs') === '/docs', 'slug path')
assert(publishedPagePath('') === '/', 'empty → /')

console.log('verify-search-query: pass')
