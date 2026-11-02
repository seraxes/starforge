/**
 * Smoke check: shared admin-nav keeps Site Chrome expandable with Environment.
 * Run: npx tsx scripts/verify-admin-nav-site-chrome.mts
 */
import { buildAdminNavGroups } from '../src/core/admin-nav/build.ts'

const flags = {
  nav: true,
  forms: true,
  layout: true,
  pageSettings: true,
  cms: true,
}

for (const surface of ['core', 'payload'] as const) {
  const groups = buildAdminNavGroups({ surface, flags })
  const siteChrome = groups.find((g) => g.id === 'site-chrome')
  if (!siteChrome) {
    console.error(`[${surface}] missing site-chrome group`)
    process.exit(1)
  }
  if (!siteChrome.expandable) {
    console.error(`[${surface}] site-chrome must be expandable`)
    process.exit(1)
  }
  if (!siteChrome.defaultOpen) {
    console.error(`[${surface}] site-chrome must defaultOpen so Environment is visible`)
    process.exit(1)
  }
  const env = siteChrome.links.find((l) => l.href === '/app/admin/site-chrome/environment')
  if (!env || env.label !== 'Environment') {
    console.error(`[${surface}] Site Chrome missing Environment child`, siteChrome.links)
    process.exit(1)
  }
  if (siteChrome.links.length < 2) {
    console.error(`[${surface}] Site Chrome must have submenu children`, siteChrome.links)
    process.exit(1)
  }
  console.log(`[${surface}] ok — Site Chrome accordion → Environment (defaultOpen)`)
}

console.log('verify-admin-nav-site-chrome: pass')
