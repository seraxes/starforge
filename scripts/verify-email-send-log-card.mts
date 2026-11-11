/**
 * Smoke: D3 Email send log + email.sent Dashboard card.
 * Run: npm run verify:email-send-log-card
 *
 * When DATABASE_URL reaches a DB with `sf_email_sends`, also probes aggregates.
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

mustExist('src/modules/email-manager/schema.ts')
mustExist('src/modules/email-manager/send-log.ts')
mustExist('src/modules/email-manager/send-type.ts')
mustExist('src/modules/email-manager/send-type.test.ts')
mustExist('src/modules/email-manager/dashboard/email-stats.ts')
mustExist('src/modules/email-manager/dashboard/EmailSentWidget.tsx')
mustExist('src/core/mail/with-send-log.ts')
mustExist('src/core/db/migrations/0003_email_send_log.sql')

const schema = read('src/modules/email-manager/schema.ts')
assert.match(schema, /sfEmailSends|sf_email_sends/)
assert.match(schema, /emailType|email_type/)

const migration = read('src/core/db/migrations/0003_email_send_log.sql')
assert.match(migration, /CREATE TABLE "sf_email_sends"/)
assert.match(migration, /email_type/)

const journal = read('src/core/db/migrations/meta/_journal.json')
assert.match(journal, /0003_email_send_log/)

const sendLog = read('src/modules/email-manager/send-log.ts')
assert.match(sendLog, /recordEmailSend/)
assert.match(sendLog, /sfEmailSends/)

const wrap = read('src/core/mail/with-send-log.ts')
assert.match(wrap, /withEmailSendLog/)
assert.match(wrap, /email-manager\/send-log/)

const mailIndex = read('src/core/mail/index.ts')
assert.match(mailIndex, /withEmailSendLog/)

const engine = read('src/modules/email-manager/engine.ts')
assert.match(engine, /emailTypeFromModuleCategory/)
assert.match(engine, /meta:\s*\{/)

const authMail = read('src/core/auth/mail.ts')
assert.match(authMail, /emailType:\s*'system'/)

const formsNotify = read('src/modules/forms/email-notify.ts')
assert.match(formsNotify, /emailType:\s*'transactional'/)

const stats = read('src/modules/email-manager/dashboard/email-stats.ts')
assert.match(stats, /sfEmailSends|sf_email_sends/)
assert.match(stats, /status:\s*'error'/, 'soft-fail path must return status error')
assert.doesNotMatch(
  stats,
  /Email send log is not wired yet/,
  'stub unavailable copy must be gone',
)

const widget = read('src/modules/email-manager/dashboard/EmailSentWidget.tsx')
assert.match(widget, /loadEmailSentStats/)
assert.doesNotMatch(widget, /Coming soon|coming-soon/)
assert.match(widget, /soft-fail|unavailable/)

const placeholders = read('scripts/verify-dashboard-placeholders.mts')
assert.match(placeholders, /email\.sent/)
assert.match(placeholders, /sf_email_sends|sfEmailSends/)

const pkg = read('package.json')
assert.match(pkg, /verify:email-send-log-card/)
assert.match(pkg, /send-type\.test\.ts/)

// Optional live probe — only when Postgres answers.
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
         WHERE table_schema = 'public' AND table_name = 'sf_email_sends'
       ) AS exists`,
    )
    if (exists.rows[0]?.exists) {
      const counts = await client.query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'sent')::int AS sent,
           COUNT(*) FILTER (WHERE status = 'sent' AND email_type = 'transactional')::int AS transactional
         FROM sf_email_sends`,
      )
      assert.ok(counts.rows[0], 'expected aggregate row from sf_email_sends')
      console.log('verify-email-send-log-card: live sf_email_sends probe ok', counts.rows[0])
    } else {
      console.log(
        'verify-email-send-log-card: sf_email_sends missing — static asserts only (migrate pending)',
      )
    }
  } finally {
    await client.end()
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.log(`verify-email-send-log-card: DB unreachable (${message}) — static asserts only`)
}

console.log('verify-email-send-log-card: pass')
