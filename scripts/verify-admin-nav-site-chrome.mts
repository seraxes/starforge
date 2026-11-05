/**
 * Smoke check: shared admin-nav keeps Chrome expandable with Environment.
 * Run: npx tsx scripts/verify-admin-nav-site-chrome.mts
 */
import { buildAdminNavGroups } from '../src/core/admin-nav/build.ts'

const flags = {
  nav: true,
  layout: true,
  pageSettings: true,
  cms: true,
}

const enabledModuleIds = new Set([
  'product:forms',
  'product:email-manager',
  'product:redirects',
  'product:media',
])

for (const surface of ['core', 'payload'] as const) {
  const groups = buildAdminNavGroups({ surface, flags, enabledModuleIds })
  const dashboard = groups[0]
  if (!dashboard || dashboard.id !== 'dashboard') {
    console.error(`[${surface}] first nav group must be Dashboard`, groups.map((g) => g.id))
    process.exit(1)
  }
  if (dashboard.href !== '/admin' || dashboard.links[0]?.href !== '/admin' || !dashboard.links[0]?.exact) {
    console.error(`[${surface}] Dashboard must be exact /admin (not Users)`, dashboard)
    process.exit(1)
  }
  console.log(`[${surface}] ok — first nav = Dashboard → /admin`)

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
  const chromeLeaf = siteChrome.links.find((l) => l.href === '/admin/site-chrome')
  if (!chromeLeaf || chromeLeaf.label !== 'Chrome') {
    console.error(`[${surface}] Chrome missing Chrome leaf`, siteChrome.links)
    process.exit(1)
  }
  const env = siteChrome.links.find((l) => l.href === '/admin/site-chrome/environment')
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
    { href: '/admin/settings', label: 'Modules' },
    { href: '/admin/settings/admin-ux', label: 'Admin UX' },
    { href: '/admin/settings/auth', label: 'Auth & registration' },
    { href: '/admin/settings/security', label: 'Security' },
    { href: '/admin/settings/performance', label: 'Performance' },
  ]
  for (const want of expectedSettings) {
    const hit = siteSettings.links.find((l) => l.href === want.href && l.label === want.label)
    if (!hit) {
      console.error(`[${surface}] Settings missing ${want.label}`, siteSettings.links)
      process.exit(1)
    }
  }
  console.log(`[${surface}] ok — Settings accordion topics`)

  const email = groups.find((g) => g.id === 'email')
  if (!email?.expandable) {
    console.error(`[${surface}] Email must be expandable (Rules + Templates)`, email)
    process.exit(1)
  }
  const emailRules = email.links.find((l) => l.href === '/admin/email' && l.label === 'Rules')
  const emailTemplates = email.links.find(
    (l) => l.href === '/admin/email/templates' && l.label === 'Templates',
  )
  if (!emailRules?.exact || !emailTemplates) {
    console.error(`[${surface}] Email missing Rules (exact) + Templates children`, email.links)
    process.exit(1)
  }
  console.log(`[${surface}] ok — Email accordion → Rules + Templates`)

  const redirects = groups.find((g) => g.id === 'redirects')
  if (!redirects?.links.some((l) => l.href === '/admin/redirects' && l.label === 'Redirects')) {
    console.error(`[${surface}] missing Redirects nav leaf`, redirects?.links)
    process.exit(1)
  }
  console.log(`[${surface}] ok — Redirects leaf`)

  const media = groups.find((g) => g.id === 'media')
  if (!media?.expandable) {
    console.error(`[${surface}] Media must be expandable (Library + Settings)`, media)
    process.exit(1)
  }
  if (!media.defaultOpen) {
    console.error(`[${surface}] Media must defaultOpen so Library/Settings stay visible`, media)
    process.exit(1)
  }
  const mediaLibrary = media.links.find((l) => l.href === '/admin/media' && l.label === 'Library')
  const mediaSettings = media.links.find(
    (l) => l.href === '/admin/media/settings' && l.label === 'Settings',
  )
  if (!mediaLibrary?.exact || !mediaSettings) {
    console.error(`[${surface}] Media missing Library (exact) + Settings children`, media.links)
    process.exit(1)
  }
  if (media.links.some((l) => l.label === 'Media' && l.href === '/admin/media')) {
    console.error(`[${surface}] Media must not keep a flat Media leaf label`, media.links)
    process.exit(1)
  }
  console.log(`[${surface}] ok — Media accordion → Library + Settings (defaultOpen)`)

  const layouts = groups.find((g) => g.id === 'layouts')
  if (!layouts?.links.some((l) => l.href === '/admin/page-settings' && l.label === 'Page settings')) {
    console.error(`[${surface}] Layouts missing Page settings child`, layouts?.links)
    process.exit(1)
  }
  const faNav = layouts.links.find(
    (l) =>
      l.href === '/admin/page-settings#font-awesome' ||
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

  if (cms.href !== '/cms/admin') {
    console.error(`[${surface}] CMS group href must be /cms/admin, got`, cms.href)
    process.exit(1)
  }
  const cmsDash = cms.links.find((l) => l.label === 'Dashboard')
  if (!cmsDash || cmsDash.href !== '/cms/admin' || !cmsDash.exact) {
    console.error(`[${surface}] CMS → Dashboard must be exact /cms/admin`, cmsDash)
    process.exit(1)
  }
  if (cms.links.some((l) => l.href === '/admin' || l.href.startsWith('/admin/'))) {
    console.error(
      `[${surface}] CMS accordion must not link into Core /admin/*`,
      cms.links,
    )
    process.exit(1)
  }
  if (!cms.links.every((l) => l.href === '/cms/admin' || l.href.startsWith('/cms/admin/'))) {
    console.error(`[${surface}] CMS children must stay under /cms/admin`, cms.links)
    process.exit(1)
  }
  console.log(`[${surface}] ok — CMS → Dashboard /cms/admin (Payload only)`)
}

console.log('verify-admin-nav-site-chrome: pass')
