/**
 * Smoke checks for multilang P2 — SEO hreflang, locale switcher, nav hrefs,
 * redirect locale policy, admin-addable locale catalog.
 * Run: npx tsx scripts/verify-i18n-p2-seo-nav.mts
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function read(rel: string): string {
  return readFileSync(join(root, rel), 'utf8')
}

assert.equal(existsSync(join(root, 'src/core/i18n/alternates.ts')), true)
assert.equal(existsSync(join(root, 'src/core/i18n/nav.ts')), true)
assert.equal(existsSync(join(root, 'src/core/i18n/enabled.ts')), true)
assert.equal(existsSync(join(root, 'src/components/LocaleSwitcher.tsx')), true)
assert.equal(
  existsSync(join(root, 'src/core/modules/particles/locale-switcher.tsx')),
  true,
)
console.log('P2 core files: ok')

const metadata = read('src/core/content/metadata.ts')
assert.match(metadata, /languageAlternateMetadata|buildLanguageAlternates/)
assert.match(metadata, /getEnabledPublicLocales/)
console.log('page metadata hreflang: ok')

const sitemapRoute = read('src/app/(frontend)/sitemap.ts')
assert.match(sitemapRoute, /buildLanguageAlternates/)
assert.match(sitemapRoute, /getEnabledPublicLocales/)
console.log('sitemap hreflang from Localization: ok')

const siteNav = read('src/components/SiteNav.tsx')
assert.match(siteNav, /navHref|isLocaleAwareNavItemActive/)
assert.match(siteNav, /from '@\/core\/i18n\/(navigation|nav)'/)
assert.equal(
  /from '@\/core\/i18n'/.test(siteNav),
  false,
  'SiteNav must not import the i18n barrel (server-only enabled leak)',
)
const i18nBarrel = read('src/core/i18n/index.ts')
assert.equal(
  /from '\.\/enabled'/.test(i18nBarrel),
  false,
  'i18n barrel must not re-export server-only ./enabled',
)
console.log('SiteNav locale-aware (client-safe): ok')

const switcher = read('src/components/LocaleSwitcher.tsx')
assert.match(switcher, /withLocalePrefix/)
assert.match(switcher, /data-sf-locale-switcher/)
console.log('LocaleSwitcher: ok')

const particles = read('src/core/modules/particles/index.ts')
assert.match(particles, /localeSwitcherModule/)
const host = read('src/core/modules/host-manifests.ts')
assert.match(host, /id:\s*'locale-switcher'/)
console.log('locale-switcher particle: ok')

const redirects = read('src/modules/redirects/paths.ts')
assert.match(redirects, /path-relative/)
assert.match(redirects, /resolveLocaleAwareRedirectPath/)
assert.match(redirects, /pathnameWithoutLocale/)
const redirectProxy = read('src/modules/redirects/proxy.ts')
assert.match(redirectProxy, /resolveLocaleAwareRedirectPath/)
assert.match(redirectProxy, /lookupEnabledRedirect/)
const proxy = read('src/proxy.ts')
assert.match(proxy, /runProxyHooks/)
assert.match(proxy, /getLocalizationSettings/)
assert.match(proxy, /createMiddleware\(\{/)
console.log('redirect policy + dynamic i18n middleware: ok')

const locales = read('src/core/i18n/locales.ts')
assert.match(locales, /isValidLocaleCode/)
assert.match(locales, /DEFAULT_LOCALE_CATALOG/)
assert.match(locales, /toPayloadLocale/)
const locTypes = read('src/core/localization/types.ts')
assert.match(locTypes, /localeCatalog/)
const locForm = read('src/app/(frontend)/admin/localization/localization-form.tsx')
assert.match(locForm, /addLocaleCode/)
assert.match(locForm, /addLocaleLabel/)
assert.match(locForm, /payload\.config\.ts/)
assert.match(locForm, /do <strong>not<\/strong> hot-reload|do not hot-reload|do \*\*not\*\* hot-reload|hot-reload/i)
console.log('admin-addable locale catalog: ok')

const chromeTypes = read('src/core/site-chrome/types.ts')
assert.match(chromeTypes, /localeCatalog/)
const chromeHeal = read('src/core/site-chrome/normalize.ts')
assert.match(chromeHeal, /localeCatalog/)
console.log('Site Chrome localeCatalog persistence: ok')

console.log('verify-i18n-p2-seo-nav: all ok')
