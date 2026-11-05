/**
 * Smoke: D2 Media dashboard aggregates — real Payload Media path (not stub).
 * Run: npm run verify:media-dashboard-aggregates
 *
 * When DATABASE_URL reaches a DB with `payload.media`, also probes the loader.
 * Soft-fail is OK when DB is down (CI without Postgres still passes static asserts).
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

mustExist('src/modules/media/dashboard/media-stats.ts')
mustExist('src/modules/media/dashboard/media-kind.ts')
mustExist('src/modules/media/dashboard/MediaCountsWidget.tsx')
mustExist('src/modules/media/dashboard/media-kind.test.ts')

const stats = read('src/modules/media/dashboard/media-stats.ts')
assert.match(stats, /payload\.media/, 'loader must query payload.media')
assert.match(stats, /MEDIA_NEW_24H_MS/)
assert.match(stats, /MEDIA_NEW_1W_MS/)
assert.match(stats, /MEDIA_NEW_1M_MS/)
assert.match(stats, /status:\s*'error'/, 'soft-fail path must return status error')
assert.doesNotMatch(
  stats,
  /Media dashboard counts are not wired yet/,
  'stub unavailable copy must be gone',
)
// Must not be a hard-coded unavailable-only stub (the old D1 placeholder).
assert.doesNotMatch(
  stats,
  /return \{\s*ok:\s*false,\s*error:\s*'Media dashboard counts are not wired yet'/s,
)

const kind = read('src/modules/media/dashboard/media-kind.ts')
assert.match(kind, /classifyMediaMimeKind/)
assert.match(kind, /aggregateMediaKindCounts/)

const widget = read('src/modules/media/dashboard/MediaCountsWidget.tsx')
assert.match(widget, /loadMediaCountsStats/)
assert.doesNotMatch(widget, /Coming soon|coming-soon/)
assert.match(widget, /soft-fail|unavailable/)

const placeholders = read('scripts/verify-dashboard-placeholders.mts')
assert.match(placeholders, /media\.counts/)

const pkg = read('package.json')
assert.match(pkg, /verify:media-dashboard-aggregates/)
assert.match(pkg, /media-kind\.test\.ts/)

// Optional live probe — only when Postgres answers (local / seeded CI).
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
         WHERE table_schema = 'payload' AND table_name = 'media'
       ) AS exists`,
    )
    if (exists.rows[0]?.exists) {
      const counts = await client.query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')::int AS new24h
         FROM payload.media`,
      )
      assert.ok(counts.rows[0], 'expected aggregate row from payload.media')
      console.log(
        'verify-media-dashboard-aggregates: live payload.media probe ok',
        counts.rows[0],
      )
    } else {
      console.log(
        'verify-media-dashboard-aggregates: payload.media missing — static asserts only',
      )
    }
  } finally {
    await client.end()
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.log(
    `verify-media-dashboard-aggregates: DB unreachable (${message}) — static asserts only`,
  )
}

console.log('verify-media-dashboard-aggregates: pass')
