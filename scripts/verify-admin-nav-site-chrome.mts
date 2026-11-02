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

  const siteSettings = groups.find((g) => g.id === 'site-settings')
  if (!siteSettings?.links.some((l) => l.href === '/app/admin/settings')) {
    console.error(`[${surface}] missing top-level Core Site Settings`, groups)
    process.exit(1)
  }

  const cms = groups.find((g) => g.id === 'cms')
  if (!cms) {
    console.error(`[${surface}] missing cms group`)
    process.exit(1)
  }
  const cmsSiteSettings = cms.links.find(
    (l) =>
      l.href.includes('/globals/site-settings') ||
      /^site settings$/i.test(l.label.trim()),
  )
  if (cmsSiteSettings) {
    console.error(
      `[${surface}] CMS accordion must not list Site Settings (Core top-level only)`,
      cms.links,
    )
    process.exit(1)
  }
  console.log(`[${surface}] ok — Site Settings top-level only (not under CMS)`)
}

console.log('verify-admin-nav-site-chrome: pass')
