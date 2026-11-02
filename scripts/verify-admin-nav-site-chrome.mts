/**
 * Smoke check: shared admin-nav keeps Chrome expandable with Environment.
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
  if (siteChrome.label !== 'Chrome') {
    console.error(`[${surface}] site-chrome parent label must be Chrome`, siteChrome.label)
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
  const chromeLeaf = siteChrome.links.find((l) => l.href === '/app/admin/site-chrome')
  if (!chromeLeaf || chromeLeaf.label !== 'Chrome') {
    console.error(`[${surface}] Chrome missing Chrome leaf`, siteChrome.links)
    process.exit(1)
  }
  const env = siteChrome.links.find((l) => l.href === '/app/admin/site-chrome/environment')
  if (!env || env.label !== 'Environment') {
    console.error(`[${surface}] Chrome missing Environment child`, siteChrome.links)
    process.exit(1)
  }
  if (siteChrome.links.length < 2) {
    console.error(`[${surface}] Chrome must have submenu children`, siteChrome.links)
    process.exit(1)
  }
  console.log(`[${surface}] ok — Chrome accordion → Environment (defaultOpen)`)

  const siteSettings = groups.find((g) => g.id === 'site-settings')
  if (!siteSettings?.expandable) {
    console.error(`[${surface}] Settings must be expandable`, siteSettings)
    process.exit(1)
  }
  if (siteSettings.label !== 'Settings') {
    console.error(`[${surface}] site-settings parent label must be Settings`, siteSettings.label)
    process.exit(1)
  }
  const expectedSettings = [
    { href: '/app/admin/settings', label: 'Modules' },
    { href: '/app/admin/settings/admin-ux', label: 'Admin UX' },
    { href: '/app/admin/settings/auth', label: 'Auth & registration' },
    { href: '/app/admin/settings/security', label: 'Security' },
    { href: '/app/admin/settings/performance', label: 'Performance' },
  ]
  for (const want of expectedSettings) {
    const hit = siteSettings.links.find((l) => l.href === want.href && l.label === want.label)
    if (!hit) {
      console.error(`[${surface}] Settings missing ${want.label}`, siteSettings.links)
      process.exit(1)
    }
  }
  console.log(`[${surface}] ok — Settings accordion topics`)

  const layouts = groups.find((g) => g.id === 'layouts')
  if (!layouts?.links.some((l) => l.href === '/app/admin/page-settings' && l.label === 'Page settings')) {
    console.error(`[${surface}] Layouts missing Page settings child`, layouts?.links)
    process.exit(1)
  }
  const faNav = layouts.links.find(
    (l) =>
      l.href === '/app/admin/page-settings#font-awesome' ||
      /^font awesome$/i.test(l.label.trim()),
  )
  if (faNav) {
    console.error(
      `[${surface}] Layouts must not list orphan Font Awesome leaf (Page settings panel only)`,
      layouts.links,
    )
    process.exit(1)
  }
  console.log(`[${surface}] ok — Layouts → Page settings (no Font Awesome nav leaf)`)

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
      `[${surface}] CMS accordion must not list Settings (Core top-level only)`,
      cms.links,
    )
    process.exit(1)
  }
  console.log(`[${surface}] ok — Settings top-level only (not under CMS)`)
}

console.log('verify-admin-nav-site-chrome: pass')
