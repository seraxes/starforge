/**
 * Smoke: Dashboard soft placeholders — per-module cards (no Stats pack).
 * Card set: Users, Security, Performance, Media, Forms, Email, Events, Marketplace.
 * Run: npm run verify:dashboard-placeholders
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function read(rel: string): string {
  return readFileSync(path.join(ROOT, rel), 'utf8')
}

function mustExist(rel: string) {
  assert.ok(existsSync(path.join(ROOT, rel)), `missing ${rel}`)
}

mustExist('src/core/dashboard/widgets/DashboardSoftPlaceholder.tsx')
mustExist('src/core/dashboard/widgets/SecurityPostureWidget.tsx')
mustExist('src/core/dashboard/widgets/security-stats.ts')
mustExist('src/core/dashboard/widgets/PerformanceGlanceWidget.tsx')
mustExist('src/core/dashboard/widgets/performance-stats.ts')
mustExist('src/modules/media/dashboard/MediaCountsWidget.tsx')
mustExist('src/modules/media/dashboard/media-stats.ts')
mustExist('src/modules/media/dashboard/media-kind.ts')
mustExist('src/modules/email-manager/dashboard/EmailSentWidget.tsx')
mustExist('src/modules/email-manager/dashboard/email-stats.ts')
mustExist('src/modules/forms/dashboard/FormsSubmissionsWidget.tsx')
mustExist('src/modules/forms/dashboard/forms-stats.ts')
mustExist('src/modules/events/dashboard/EventsUpcomingWidget.tsx')
mustExist('src/modules/events/dashboard/events-stats.ts')
mustExist('src/modules/marketplace/dashboard/MarketplaceListingsWidget.tsx')
mustExist('src/modules/marketplace/dashboard/marketplace-stats.ts')

assert.equal(existsSync(path.join(ROOT, 'src/modules/stats')), false, 'no product:stats pack')

const hostManifest = read('src/core/modules/host-manifests.ts')
assert.match(hostManifest, /id: 'users\.strip'/)
assert.match(hostManifest, /id: 'users\.latest'/)
assert.match(hostManifest, /id: 'security\.posture'/)
assert.match(hostManifest, /id: 'performance\.glance'/)
assert.doesNotMatch(hostManifest, /product:stats/)

const mediaManifest = read('src/modules/media/manifest.ts')
assert.match(mediaManifest, /id: 'media\.counts'/)

// D2: media.counts loader must hit Payload Media (not the old hard unavailable stub)
const mediaStats = read('src/modules/media/dashboard/media-stats.ts')
assert.match(mediaStats, /payload\.media/)
assert.doesNotMatch(mediaStats, /Media dashboard counts are not wired yet/)

const emailManifest = read('src/modules/email-manager/manifest.ts')
assert.match(emailManifest, /id: 'email\.sent'/)

const formsManifest = read('src/modules/forms/manifest.ts')
assert.match(formsManifest, /id: 'forms\.submissions'/)

// Core glance cards live: Forms / Security / Performance (not hard unavailable stubs)
const formsStats = read('src/modules/forms/dashboard/forms-stats.ts')
assert.match(formsStats, /sfFormSubmissions|sf_form_submissions/)
assert.doesNotMatch(formsStats, /Forms submissions dashboard counts are not wired yet/)

const securityStats = read('src/core/dashboard/widgets/security-stats.ts')
assert.match(securityStats, /getSiteChrome/)
assert.doesNotMatch(securityStats, /Security posture glance is not wired yet/)

const performanceStats = read('src/core/dashboard/widgets/performance-stats.ts')
assert.match(performanceStats, /getSiteSettings/)
assert.doesNotMatch(performanceStats, /Performance glance is not wired yet/)

const eventsManifest = read('src/modules/events/manifest.ts')
assert.match(eventsManifest, /id: 'product:events'/)
assert.match(eventsManifest, /id: 'events\.upcoming'/)

const marketplaceManifest = read('src/modules/marketplace/manifest.ts')
assert.match(marketplaceManifest, /id: 'product:marketplace'/)
assert.match(marketplaceManifest, /id: 'marketplace\.listings'/)

const allowlist = read('starforge.modules.json')
assert.match(allowlist, /"product:events"/)
assert.match(allowlist, /"product:marketplace"/)
assert.doesNotMatch(allowlist, /product:stats/)

const registry = read('src/generated/module-registry.ts')
for (const id of [
  'users.strip',
  'users.latest',
  'security.posture',
  'performance.glance',
  'media.counts',
  'forms.submissions',
  'email.sent',
  'events.upcoming',
  'marketplace.listings',
  'product:events',
  'product:marketplace',
  'product:forms',
  'product:media',
  'product:email-manager',
]) {
  assert.match(registry, new RegExp(id.replace(/\./g, '\\.')), `registry missing ${id}`)
}
assert.doesNotMatch(registry, /product:stats/)

const registryServer = read('src/generated/module-registry.server.ts')
for (const name of [
  'UsersStripWidget',
  'SecurityPostureWidget',
  'PerformanceGlanceWidget',
  'MediaCountsWidget',
  'FormsSubmissionsWidget',
  'EmailSentWidget',
  'EventsUpcomingWidget',
  'MarketplaceListingsWidget',
  'loadSecurityPostureStats',
  'loadPerformanceGlanceStats',
  'loadFormsSubmissionsStats',
  'loadEventsUpcomingStats',
  'loadMarketplaceListingsStats',
]) {
  assert.match(registryServer, new RegExp(name), `server registry missing ${name}`)
}

const host = read('src/core/dashboard/host.tsx')
assert.match(host, /page-settings-panel/)
assert.match(host, /module-disabled|moduleEnabled/)
assert.match(host, /DashboardSoftPlaceholder/)

const resolve = read('src/core/dashboard/resolve.ts')
assert.match(resolve, /moduleEnabled/)
assert.doesNotMatch(
  resolve,
  /\.filter\(\(entry\) => \(enabled \? enabled\.has\(entry\.moduleId\) : true\)\)/,
  'resolve must keep soft shells when module toggle is off',
)

const placeholder = read('src/core/dashboard/widgets/DashboardSoftPlaceholder.tsx')
assert.match(placeholder, /Coming soon/)
assert.match(placeholder, /Module disabled/)

// Core must not import product-pack dashboard widgets directly (registry loaders only)
const { readdirSync, statSync } = await import('node:fs')
const coreHits: string[] = []
function walk(dir: string) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) {
      walk(full)
      continue
    }
    if (!/\.(ts|tsx)$/.test(name)) continue
    const src = readFileSync(full, 'utf8')
    if (
      /from ['"]@\/modules\/(?:media|email-manager|forms|events|marketplace)\/dashboard/.test(src)
    ) {
      coreHits.push(path.relative(ROOT, full))
    }
  }
}
walk(path.join(ROOT, 'src/core'))
assert.equal(
  coreHits.length,
  0,
  `Core must not import module dashboard widgets:\n${coreHits.join('\n')}`,
)

console.log('verify-dashboard-placeholders: pass')
