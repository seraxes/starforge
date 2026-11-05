/**
 * Smoke: wire real data for Forms / Security / Performance Dashboard cards.
 * Events + Marketplace stay soft stubs. Soft-fail OK.
 * Run: npm run verify:core-glance-cards-live
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

mustExist('src/modules/forms/dashboard/forms-stats.ts')
mustExist('src/modules/forms/dashboard/forms-glance.ts')
mustExist('src/modules/forms/dashboard/FormsSubmissionsWidget.tsx')
mustExist('src/modules/forms/dashboard/forms-stats-format.test.ts')
mustExist('src/core/dashboard/widgets/security-stats.ts')
mustExist('src/core/dashboard/widgets/security-posture.ts')
mustExist('src/core/dashboard/widgets/security-posture.test.ts')
mustExist('src/core/dashboard/widgets/SecurityPostureWidget.tsx')
mustExist('src/core/dashboard/widgets/performance-stats.ts')
mustExist('src/core/dashboard/widgets/performance-glance.ts')
mustExist('src/core/dashboard/widgets/performance-glance.test.ts')
mustExist('src/core/dashboard/widgets/PerformanceGlanceWidget.tsx')

// Forms — real sf_form_submissions path
const formsStats = read('src/modules/forms/dashboard/forms-stats.ts')
assert.match(formsStats, /sfFormSubmissions|sf_form_submissions/)
assert.match(formsStats, /FORMS_NEW_24H_MS/)
assert.match(formsStats, /FORMS_NEW_7D_MS/)
assert.match(formsStats, /status:\s*'error'/)
assert.doesNotMatch(formsStats, /Forms submissions dashboard counts are not wired yet/)

const formsWidget = read('src/modules/forms/dashboard/FormsSubmissionsWidget.tsx')
assert.match(formsWidget, /loadFormsSubmissionsStats/)
assert.doesNotMatch(formsWidget, /Coming soon|coming-soon/)
assert.match(formsWidget, /soft-fail|unavailable/)

// Security — Site Chrome captcha + always-on posture
const securityStats = read('src/core/dashboard/widgets/security-stats.ts')
assert.match(securityStats, /getSiteChrome/)
assert.match(securityStats, /formatCaptchaPosture/)
assert.doesNotMatch(securityStats, /Security posture glance is not wired yet/)

const securityWidget = read('src/core/dashboard/widgets/SecurityPostureWidget.tsx')
assert.doesNotMatch(securityWidget, /Coming soon|coming-soon/)
assert.match(securityWidget, /soft-fail|unavailable/)

// Performance — Site Settings knobs
const performanceStats = read('src/core/dashboard/widgets/performance-stats.ts')
assert.match(performanceStats, /getSiteSettings/)
assert.match(performanceStats, /formatDashboardRefreshGlance|dashboardRefreshIntervalSec/)
assert.doesNotMatch(performanceStats, /Performance glance is not wired yet/)

const performanceWidget = read('src/core/dashboard/widgets/PerformanceGlanceWidget.tsx')
assert.doesNotMatch(performanceWidget, /Coming soon|coming-soon/)
assert.match(performanceWidget, /soft-fail|unavailable/)

// Events + Marketplace remain soft stubs (no schema yet)
const eventsStats = read('src/modules/events/dashboard/events-stats.ts')
assert.match(eventsStats, /ok:\s*false/)
assert.match(eventsStats, /unavailable|not shipped/i)

const marketplaceStats = read('src/modules/marketplace/dashboard/marketplace-stats.ts')
assert.match(marketplaceStats, /ok:\s*false/)
assert.match(marketplaceStats, /unavailable|not shipped/i)

const pkg = read('package.json')
assert.match(pkg, /verify:core-glance-cards-live/)
assert.match(pkg, /forms-stats-format\.test\.ts/)
assert.match(pkg, /security-posture\.test\.ts/)
assert.match(pkg, /performance-glance\.test\.ts/)

const placeholders = read('scripts/verify-dashboard-placeholders.mts')
assert.match(placeholders, /forms\.submissions/)
assert.match(placeholders, /security\.posture/)
assert.match(placeholders, /performance\.glance/)

// Optional live probe — Forms table only (Security/Performance are settings, not SQL).
const databaseUrl =
  process.env.DATABASE_URL || 'postgresql://starforge:starforge@127.0.0.1:5432/starforge'

try {
  const pg = await import('pg')
  const client = new pg.default.Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 1500,
  })
  await client.connect()
  try {
    const exists = await client.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'sf_form_submissions'
       ) AS exists`,
    )
    if (exists.rows[0]?.exists) {
      const counts = await client.query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')::int AS new24h,
           COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS new7d
         FROM sf_form_submissions`,
      )
      assert.ok(counts.rows[0], 'expected aggregate row from sf_form_submissions')
      console.log(
        'verify-core-glance-cards-live: live sf_form_submissions probe ok',
        counts.rows[0],
      )
    } else {
      console.log(
        'verify-core-glance-cards-live: sf_form_submissions missing — static asserts only',
      )
    }
  } finally {
    await client.end()
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.log(
    `verify-core-glance-cards-live: DB unreachable (${message}) — static asserts only`,
  )
}

console.log('verify-core-glance-cards-live: pass')
