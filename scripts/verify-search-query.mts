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

assert(publishedPagePath('home', 'en') === '/en', 'home → /en')
assert(publishedPagePath('home', 'hu') === '/hu', 'home → /hu')
assert(publishedPagePath('/about', 'en') === '/en/about', 'strip leading slash + locale')
assert(publishedPagePath('docs', 'hu') === '/hu/docs', 'slug path + locale')
assert(publishedPagePath('', 'en') === '/en', 'empty → /en')

console.log('verify-search-query: pass')
