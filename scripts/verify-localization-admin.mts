/**
 * Lock: Localization admin page owns locale fields; Site Chrome only links.
 * Soft-heal of locale keys on Chrome JSON load remains.
 * Run: npx tsx scripts/verify-localization-admin.mts
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildAdminNavGroups } from '../src/core/admin-nav/build.ts'
import { adminAreaGateForPath } from '../src/core/acl/decide.ts'
import { ACL_ADMIN_RESOURCES } from '../src/core/acl/types.ts'

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
  form.includes('/admin/localization'),
  'site-chrome-form must link to /admin/localization',
)
must(
  !form.includes('Localization (stub)'),
  'site-chrome-form must not keep Localization (stub) editor',
)
must(
  !/localesEnabled/.test(form),
  'site-chrome-form must not edit localesEnabled (moved to Localization)',
)

const localizationPage = readFileSync(
  join(root, 'src/app/(frontend)/admin/localization/page.tsx'),
  'utf8',
)
must(
  localizationPage.includes('getLocalizationSettings'),
  'localization page must load getLocalizationSettings',
)

const localizationForm = readFileSync(
  join(root, 'src/app/(frontend)/admin/localization/localization-form.tsx'),
  'utf8',
)
must(
  localizationForm.includes('name="localesEnabled"'),
  'localization form must edit localesEnabled',
)
must(
  localizationForm.includes('name="defaultLocale"'),
  'localization form must edit defaultLocale',
)
must(
  localizationForm.includes('name="localeFallback"'),
  'localization form must edit localeFallback',
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

const normalize = readFileSync(join(root, 'src/core/site-chrome/normalize.ts'), 'utf8')
must(
  normalize.includes('localeFallback'),
  'normalize must handle localeFallback',
)
must(
  normalize.includes('export function siteChromeDocumentNeedsLocaleHeal'),
  'normalize must export siteChromeDocumentNeedsLocaleHeal',
)

must(
  ACL_ADMIN_RESOURCES.some((r) => r.key === 'admin.localization'),
  'ACL matrix must include admin.localization',
)
must(
  adminAreaGateForPath('/admin/localization').type === 'resource' &&
    (adminAreaGateForPath('/admin/localization') as { key: string }).key ===
      'admin.localization',
  'adminAreaGateForPath(/admin/localization) must map to admin.localization',
)

const groups = buildAdminNavGroups({
  surface: 'core',
  flags: { nav: true, layout: true, pageSettings: true, cms: true },
  enabledModuleIds: new Set([
    'product:forms',
    'product:email-manager',
    'product:redirects',
    'product:media',
  ]),
})
const ids = groups.map((g) => g.id)
const chromeIdx = ids.indexOf('site-chrome')
const locIdx = ids.indexOf('localization')
const settingsIdx = ids.indexOf('site-settings')
must(chromeIdx >= 0, 'nav must include site-chrome')
must(locIdx >= 0, 'nav must include localization')
must(settingsIdx >= 0, 'nav must include site-settings')
must(
  chromeIdx < locIdx && locIdx < settingsIdx,
  `Localization must sit between Chrome and Settings (got ${ids.join(',')})`,
)
const localization = groups.find((g) => g.id === 'localization')
must(
  localization?.links.some((l) => l.href === '/admin/localization' && l.label === 'Localization'),
  'Localization nav leaf must point at /admin/localization',
)

console.log('verify-localization-admin: pass')
