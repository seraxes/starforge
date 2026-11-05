/**
 * Smoke checks for multilang P1 — Payload localization + content locale bridge.
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

const payloadConfig = read('src/payload.config.ts')
assert.match(payloadConfig, /localization:\s*\{/)
assert.match(payloadConfig, /defaultLocale:\s*DEFAULT_LOCALE/)
assert.match(payloadConfig, /fallback:\s*true/)
assert.match(payloadConfig, /LOCALE_LABELS/)
console.log('payload.config localization: ok')

const pages = read('src/collections/Pages.ts')
assert.match(pages, /name:\s*'title',\s*type:\s*'text',\s*required:\s*true,\s*\/\/ Localized[\s\S]*?localized:\s*true/)
assert.match(pages, /name:\s*'body',\s*type:\s*'richText',\s*localized:\s*true/)
assert.match(pages, /label:\s*'Meta title'[\s\S]*?localized:\s*true|localized:\s*true,\s*label:\s*'Meta title'/)
assert.match(pages, /localized:\s*true,\s*label:\s*'Meta description'/)
const slugField = pages.match(/name:\s*'slug',[\s\S]*?admin:\s*\{[\s\S]*?\},/)?.[0] ?? ''
assert.ok(slugField.includes("name: 'slug'"), 'slug field present')
assert.equal(slugField.includes('localized:'), false, 'slug must not be localized')
console.log('Pages localized fields (slug shared): ok')

const contentPages = read('src/core/content/pages.ts')
assert.match(contentPages, /locale,/)
assert.match(contentPages, /fallbackLocale:\s*DEFAULT_LOCALE/)
assert.match(contentPages, /requireContentLocale/)
assert.match(contentPages, /getPublishedPageBySlug = cache\(\s*async \(slug: string, locale: AppLocale\)/)
assert.match(contentPages, /getDraftPageBySlug = cache\(\s*async \(slug: string, locale: AppLocale\)/)
console.log('content pages locale bridge: ok')

const tags = read('src/core/content/cache/tags.ts')
assert.match(tags, /sf:published-page:\$\{locale\}:\$\{slug\}/)
assert.match(tags, /pageAllLocales/)
console.log('cache tags include locale: ok')

const sitemap = read('src/core/content/sitemap.ts')
assert.match(sitemap, /withLocalePrefix/)
assert.match(sitemap, /LOCALES/)
assert.match(sitemap, /barePath/)
const sitemapRoute = read('src/app/(frontend)/sitemap.ts')
assert.match(sitemapRoute, /alternates/)
assert.match(sitemapRoute, /languages/)
console.log('sitemap locale-aware + hreflang: ok')

const search = read('src/core/content/search.ts')
assert.match(search, /locale: AppLocale/)
assert.match(search, /fallbackLocale:\s*DEFAULT_LOCALE/)
const searchQuery = read('src/core/content/search-query.ts')
assert.match(searchQuery, /publishedPagePath\(slug: string, locale: AppLocale\)/)
console.log('search locale-aware: ok')

const publicHome = read('src/app/(frontend)/(public)/[locale]/page.tsx')
assert.match(publicHome, /getPublishedPageBySlug\(HOME_SLUG,\s*locale\)/)
const publicSlug = read('src/app/(frontend)/(public)/[locale]/[slug]/page.tsx')
assert.match(publicSlug, /getPublishedPageBySlug\([^,]+,\s*locale\)/)
const preview = read('src/app/(frontend)/(public)/[locale]/preview/[slug]/page.tsx')
assert.match(preview, /getDraftPageBySlug\([^,]+,\s*locale\)/)
const searchPage = read('src/app/(frontend)/(public)/[locale]/search/page.tsx')
assert.match(searchPage, /searchPublishedPages\(query,\s*locale\)/)
console.log('public loaders pass locale: ok')

assert.equal(
  existsSync(join(root, 'src/app/(frontend)/admin/page.tsx')),
  true,
  'admin stays outside [locale]',
)
assert.equal(
  existsSync(join(root, 'src/migrations/20261105_195344_pages_localization_i18n_p1.ts')),
  true,
  'localization migration required',
)
const migrationIndex = read('src/migrations/index.ts')
assert.match(migrationIndex, /20261105_195344_pages_localization_i18n_p1/)
console.log('admin path + migration: ok')

console.log('verify-i18n-p1-payload-locales: all ok')
