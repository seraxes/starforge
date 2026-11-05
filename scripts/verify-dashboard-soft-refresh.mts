/**
 * Smoke: Dashboard D4 soft refresh — poll / router.refresh from Performance interval.
 * Run: npm run verify:dashboard-soft-refresh
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

mustExist('src/core/dashboard/DashboardSoftRefresh.tsx')
mustExist('src/core/dashboard/soft-refresh.ts')
mustExist('src/core/dashboard/soft-refresh.test.ts')

const client = read('src/core/dashboard/DashboardSoftRefresh.tsx')
assert.match(client, /'use client'/)
assert.match(client, /useRouter/)
assert.match(client, /router\.refresh\s*\(/)
assert.match(client, /visibilitychange/)
assert.match(client, /document\.hidden/)
assert.match(client, /Last refreshed/)
assert.match(client, /intervalSec/)

const helpers = read('src/core/dashboard/soft-refresh.ts')
assert.match(helpers, /dashboardRefreshIntervalMs/)
assert.match(helpers, /shouldRefreshOnBecomeVisible/)
assert.match(helpers, /formatDashboardRefreshedAt/)

const page = read('src/app/(frontend)/admin/page.tsx')
assert.match(page, /DashboardSoftRefresh/)
assert.match(page, /dashboardRefreshIntervalSec/)
assert.doesNotMatch(
  page,
  /Last refreshed/,
  'Last refreshed label must live in DashboardSoftRefresh (client), not the RSC page',
)

const form = read('src/app/(frontend)/admin/settings/performance/performance-settings-form.tsx')
assert.match(form, /dashboardRefreshIntervalSec/)
assert.doesNotMatch(
  form,
  /follow-up \(D4\)/,
  'Performance form must not still call soft refresh a D4 follow-up',
)
assert.match(form, /router\.refresh|soft-refresh|soft refresh/i)

const defaults = read('src/core/settings/defaults.ts')
assert.match(defaults, /DEFAULT_DASHBOARD_REFRESH_INTERVAL_SEC/)
assert.doesNotMatch(
  defaults,
  /client poll \/ RSC refresh wiring is D4/,
  'defaults comment must not still defer soft refresh to D4',
)

const pkg = read('package.json')
assert.match(pkg, /verify:dashboard-soft-refresh/)
assert.match(pkg, /soft-refresh\.test\.ts/)

console.log('verify-dashboard-soft-refresh: pass')
