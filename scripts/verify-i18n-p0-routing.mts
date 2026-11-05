/**
 * Smoke checks for multilang P0 — next-intl + Core i18n + [locale] public routes.
 * Run: npx tsx scripts/verify-i18n-p0-routing.mts
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function read(rel: string): string {
  return readFileSync(join(root, rel), 'utf8')
}

assert.equal(existsSync(join(root, 'src/middleware.ts')), false, 'middleware.ts must stay removed')
assert.equal(existsSync(join(root, 'src/proxy.ts')), true, 'src/proxy.ts must exist')
assert.equal(
  existsSync(join(root, 'src/app/(frontend)/(public)/[locale]/layout.tsx')),
  true,
  'public [locale] layout required',
)
assert.equal(
  existsSync(join(root, 'src/app/(frontend)/(public)/page.tsx')),
  false,
  'bare public page.tsx must move under [locale]',
)
assert.equal(
  existsSync(join(root, 'src/app/(frontend)/admin/page.tsx')),
  true,
  'admin stays outside [locale]',
)

const pkg = JSON.parse(read('package.json')) as { dependencies?: Record<string, string> }
assert.ok(pkg.dependencies?.['next-intl'], 'next-intl must be a dependency')

const nextConfig = read('next.config.ts')
assert.match(nextConfig, /createNextIntlPlugin/)
assert.match(nextConfig, /src\/core\/i18n\/request\.ts/)
assert.match(nextConfig, /withNextIntl/)
console.log('next.config next-intl plugin: ok')

const proxy = read('src/proxy.ts')
assert.match(proxy, /createMiddleware/)
assert.match(proxy, /next-intl\/middleware/)
assert.match(proxy, /handleI18nRouting|createMiddleware\(routing\)/)
assert.match(proxy, /isNonLocalizedPath/)
assert.match(proxy, /export async function proxy/)
assert.match(proxy, /lookupEnabledRedirect/)
assert.match(proxy, /getSiteChrome/)
assert.doesNotMatch(proxy, /from 'next-intl\/middleware'[\s\S]*export default/)
console.log('proxy composes next-intl (named proxy export): ok')

const routing = read('src/core/i18n/routing.ts')
assert.match(routing, /localePrefix:\s*'always'/)
assert.match(routing, /locales/)
assert.match(routing, /defaultLocale/)
console.log('routing localePrefix always: ok')

for (const locale of ['en', 'hu']) {
  assert.equal(
    existsSync(join(root, `src/core/i18n/messages/${locale}.json`)),
    true,
    `messages/${locale}.json required`,
  )
}
const en = JSON.parse(read('src/core/i18n/messages/en.json')) as {
  Auth?: Record<string, string>
  Layout?: Record<string, string>
}
assert.ok(en.Auth?.signIn, 'en Auth.signIn')
assert.ok(en.Layout?.offlineAdminBanner, 'en Layout.offlineAdminBanner')
console.log('message catalogs en/hu: ok')

const chromeTypes = read('src/core/site-chrome/types.ts')
assert.match(chromeTypes, /localesEnabled/)
assert.match(chromeTypes, /defaultLocale/)
assert.match(chromeTypes, /localeFallback/)
const chromeForm = read('src/app/(frontend)/admin/site-chrome/site-chrome-form.tsx')
assert.match(chromeForm, /\/admin\/localization/)
assert.doesNotMatch(chromeForm, /Localization \(stub\)/)
const localizationPage = read('src/app/(frontend)/admin/localization/page.tsx')
assert.match(localizationPage, /getLocalizationSettings/)
console.log('Localization admin + Chrome link: ok')

const pageKey = read('src/core/page-settings/resolve.ts')
assert.match(pageKey, /pathnameWithoutLocale/)
const offline = read('src/core/site-chrome/offline.ts')
assert.match(offline, /pathnameWithoutLocale/)
console.log('locale-aware pageKey + offline paths: ok')

console.log('verify-i18n-p0-routing: all ok')
