/**
 * Lock: Site Chrome Localization stub must guard localesEnabled.join and
 * soft-heal missing locale keys on load.
 * Run: npx tsx scripts/verify-site-chrome-locales-join.mts
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function must(cond: unknown, message: string): asserts cond {
  if (!cond) {
    console.error(message)
    process.exit(1)
  }
}

const form = readFileSync(
  join(root, 'src/app/(frontend)/admin/site-chrome/site-chrome-form.tsx'),
  'utf8',
)
must(
  form.includes('(chrome.localesEnabled ?? []).join'),
  'site-chrome-form must guard localesEnabled with (localesEnabled ?? []).join',
)
must(
  !/chrome\.localesEnabled\.join\(/.test(form),
  'site-chrome-form must not call chrome.localesEnabled.join without a nullish guard',
)

const store = readFileSync(join(root, 'src/core/site-chrome/store.ts'), 'utf8')
must(
  store.includes('siteChromeDocumentNeedsLocaleHeal'),
  'store must soft-heal via siteChromeDocumentNeedsLocaleHeal',
)
must(
  store.includes('softHealLocaleFields'),
  'store must persist softHealLocaleFields when locale keys are missing',
)
must(
  store.includes('normalizeSiteChrome'),
  'store withCookieAttrs must re-normalize (stale cache / missing keys)',
)

const normalize = readFileSync(join(root, 'src/core/site-chrome/normalize.ts'), 'utf8')
must(
  normalize.includes('export function siteChromeDocumentNeedsLocaleHeal'),
  'normalize must export siteChromeDocumentNeedsLocaleHeal',
)

console.log('verify-site-chrome-locales-join: pass')
