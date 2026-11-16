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
  'product:events',
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

  const localization = groups.find((g) => g.id === 'localization')
  if (!localization?.links.some((l) => l.href === '/admin/localization' && l.label === 'Localization')) {
    console.error(`[${surface}] missing Localization nav leaf`, localization?.links)
    process.exit(1)
  }
  const chromeIdx = groups.findIndex((g) => g.id === 'site-chrome')
  const locIdx = groups.findIndex((g) => g.id === 'localization')
  const settingsIdx = groups.findIndex((g) => g.id === 'site-settings')
  if (!(chromeIdx < locIdx && locIdx < settingsIdx)) {
    console.error(
      `[${surface}] Localization must sit between Chrome and Settings`,
      groups.map((g) => g.id),
    )
    process.exit(1)
  }
  console.log(`[${surface}] ok — Localization between Chrome and Settings`)

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

  const events = groups.find((g) => g.id === 'events')
  if (!events?.expandable) {
    console.error(`[${surface}] Events must be expandable (Events + Venues + Settings)`, events)
    process.exit(1)
  }
  const eventsList = events.links.find((l) => l.href === '/admin/events' && l.label === 'Events')
  const eventsVenues = events.links.find(
    (l) => l.href === '/admin/events/venues' && l.label === 'Venues',
  )
  const eventsSettings = events.links.find(
    (l) => l.href === '/admin/events/settings' && l.label === 'Settings',
  )
  if (!eventsList?.exact || !eventsVenues || !eventsSettings) {
    console.error(
      `[${surface}] Events missing Events (exact) + Venues + Settings children`,
      events.links,
    )
    process.exit(1)
  }
  console.log(`[${surface}] ok — Events accordion → Events + Venues + Settings`)

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

  const skins = groups.find((g) => g.id === 'skins')
  const outline = skins?.links.find((l) => l.href === '/admin/outlines' && l.label === 'Outline')
  const pageSettings = outline?.children?.find(
    (l) => l.href === '/admin/page-settings' && l.label === 'Page settings',
  )
  if (!pageSettings) {
    console.error(`[${surface}] Skins → Outline missing Page settings child`, skins?.links)
    process.exit(1)
  }
  const skinsLeaves = [...(skins?.links ?? []), ...(outline?.children ?? [])]
  const faNav = skinsLeaves.find(
    (l) =>
      l.href === '/admin/page-settings#font-awesome' ||
      /^font awesome$/i.test(l.label.trim()),
  )
  if (faNav) {
    console.error(
      `[${surface}] Skins must not list orphan Font Awesome leaf (Page settings panel only)`,
      skinsLeaves,
    )
    process.exit(1)
  }
  console.log(`[${surface}] ok — Skins → Outline → Page settings (no Font Awesome nav leaf)`)

  if (groups.some((g) => g.id === 'cms')) {
    console.error(`[${surface}] Payload CMS accordion must be gone`, groups.map((g) => g.id))
    process.exit(1)
  }
  const settings = groups.find((g) => g.id === 'site-settings')
  if (!settings) {
    console.error(`[${surface}] missing site-settings group`)
    process.exit(1)
  }
  console.log(`[${surface}] ok — no Payload CMS accordion; Settings stays top-level`)
}

console.log('verify-admin-nav-site-chrome: pass')
