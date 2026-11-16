/**
 * Smoke checks for multilang P1 — public locale bridge after the Payload shell left.
 * Run: npx tsx scripts/verify-i18n-p1-payload-locales.mts
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function read(rel: string): string {
  return readFileSync(join(root, rel), 'utf8')
}

assert.equal(existsSync(join(root, 'src/payload.config.ts')), false, 'payload.config.ts is gone')
assert.equal(
  existsSync(join(root, 'src/modules/rich-editor/payload/sfHtmlBodyField.ts')),
  false,
  'Payload page body field is gone',
)
const pagesReadme = read('src/modules/pages/README.md')
assert.match(pagesReadme, /content-locales/)
assert.doesNotMatch(pagesReadme, /until phase 4/)
console.log('pages locales live in content-locale files: ok')

const contentPages = read('src/core/content/pages.ts')
assert.match(contentPages, /locale,/)
assert.match(contentPages, /requireContentLocale/)
assert.match(contentPages, /getPageReads\(\)\.findPublishedBySlug\(slug, locale\)/)
assert.match(contentPages, /getPageReads\(\)\.findDraftBySlug\(slug, locale\)/)
assert.match(contentPages, /getPublishedPageBySlug = cache\(\s*async \(slug: string, locale: AppLocale\)/)
assert.match(contentPages, /getDraftPageBySlug = cache\(\s*async \(slug: string, locale: AppLocale\)/)
assert.doesNotMatch(contentPages, /getPayload\(/)
const pageReads = read('src/modules/pages/page-reads.ts')
assert.match(pageReads, /findPublishedBySlug/)
assert.match(pageReads, /searchPublished/)
assert.doesNotMatch(pageReads, /getPayload\(/)
console.log('content pages locale bridge: ok')

const tags = read('src/core/content/cache/tags.ts')
assert.match(tags, /sf:published-page:\$\{locale\}:\$\{slug\}/)
assert.match(tags, /pageAllLocales/)
console.log('cache tags include locale: ok')

const sitemap = read('src/core/content/sitemap.ts')
assert.match(sitemap, /withLocalePrefix/)
assert.match(sitemap, /getEnabledPublicLocales|LOCALES/)
assert.match(sitemap, /barePath/)
const sitemapRoute = read('src/app/(frontend)/sitemap.ts')
assert.match(sitemapRoute, /alternates/)
assert.match(sitemapRoute, /languages/)
console.log('sitemap locale-aware + hreflang: ok')

const search = read('src/core/content/search.ts')
assert.match(search, /locale: AppLocale/)
assert.match(search, /getPageReads\(\)\.searchPublished\(query, locale/)
assert.doesNotMatch(search, /await getPayload\(/)
const searchQuery = read('src/core/content/search-query.ts')
assert.match(searchQuery, /publishedPagePath\(slug: string, locale: AppLocale\)/)
console.log('search locale-aware: ok')

const publicHome = read('src/app/(frontend)/(public)/[locale]/page.tsx')
assert.match(publicHome, /getPublishedPageBySlug\(HOME_SLUG,\s*locale\)/)
const publicSlug = read('src/app/(frontend)/(public)/[locale]/[slug]/page.tsx')
assert.match(publicSlug, /getPublishedPageBySlug\([^,]+,\s*locale\)/)
const preview = read('src/app/(frontend)/(public)/[locale]/preview/[slug]/page.tsx')
assert.match(preview, /getDraftPageBySlug\([^,]+,\s*locale\)/)
const searchPage = read('src/modules/search/public/SearchPage.tsx')
assert.match(searchPage, /searchPublishedPages\(query,\s*locale\)/)
console.log('public loaders pass locale: ok')

assert.equal(
  existsSync(join(root, 'src/app/(frontend)/admin/page.tsx')),
  true,
  'admin stays outside [locale]',
)
assert.equal(existsSync(join(root, 'src/migrations')), false, 'Payload migrations folder is gone')
console.log('admin path + no Payload migrations: ok')

console.log('verify-i18n-p1-payload-locales: all ok')
