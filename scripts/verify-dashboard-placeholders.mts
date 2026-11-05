/**
 * Smoke: Dashboard soft placeholders — Media + Email contrib shells.
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
mustExist('src/modules/media/dashboard/MediaCountsWidget.tsx')
mustExist('src/modules/media/dashboard/media-stats.ts')
mustExist('src/modules/email-manager/dashboard/EmailSentWidget.tsx')
mustExist('src/modules/email-manager/dashboard/email-stats.ts')

const mediaManifest = read('src/modules/media/manifest.ts')
assert.match(mediaManifest, /dashboard:\s*\[/)
assert.match(mediaManifest, /id: 'media\.counts'/)
assert.match(mediaManifest, /MediaCountsWidget/)

const emailManifest = read('src/modules/email-manager/manifest.ts')
assert.match(emailManifest, /dashboard:\s*\[/)
assert.match(emailManifest, /id: 'email\.sent'/)
assert.match(emailManifest, /EmailSentWidget/)

const registry = read('src/generated/module-registry.ts')
assert.match(registry, /media\.counts/)
assert.match(registry, /email\.sent/)
assert.match(registry, /product:media/)
assert.match(registry, /product:email-manager/)

const registryServer = read('src/generated/module-registry.server.ts')
assert.match(registryServer, /MediaCountsWidget/)
assert.match(registryServer, /EmailSentWidget/)
assert.match(registryServer, /loadMediaCountsStats/)
assert.match(registryServer, /loadEmailSentStats/)

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

// Core must not import media/email dashboard widgets directly (registry loaders only)
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
    if (/from ['"]@\/modules\/(?:media|email-manager)\/dashboard/.test(src)) {
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
